const MS_TO_KNOTS = 1.943844;

// draw: { frame, low, high, weight } as produced by session.snapshot()
function wanted({ frame, low, high }) {
  return low === high ? [[low, frame]] : [[low, frame], [high, frame]];
}

// Same contract as parseCurrents(), but frames are fetched on demand.
export function createFrameModel(meta, store) {
  const { nx, ny, scale, sentinel, lat, lon } = meta;
  const active = [];

  function frameFor(c, t) {
    const memo = active[c];
    if (memo && memo.t === t) return memo.frame;

    const frame = store.peek(meta, c, t);
    if (frame) active[c] = { t, frame };
    return frame;
  }

  return {
    info: JSON.stringify(
      {
        id: meta.id,
        label: meta.label,
        frames: meta.nt,
        ny,
        nx,
        coeffs: meta.coeffs,
        release: meta.release,
      },
      null,
      2
    ),
    release: meta.release,
    ny,
    nx,
    timeCount: meta.nt,
    depthCount: 1,
    coeffCount: meta.coeffs.length,
    times: [],
    offsets: meta.offsets,
    tidal: true,
    reference: meta.reference,
    depths: meta.depths,
    coeffs: meta.coeffs,
    maxSpeed: meta.maxSpeedKn / MS_TO_KNOTS,
    bounds: [
      [lat[0], lon[0]],
      [lat[lat.length - 1], lon[lon.length - 1]],
    ],
    latAt: (y) => lat[y],
    lonAt: (_y, x) => lon[x],

    // Returns [east, north] in m/s, or null for land and frames that are not loaded yet.
    vectorAt(t, _depth, c, y, x) {
      const frame = frameFor(c, t);
      if (!frame) return null;

      const i = (y * nx + x) * 2;
      const u = frame[i];
      const v = frame[i + 1];
      return u === sentinel || v === sentinel ? null : [u * scale, v * scale];
    },

    isReady(draw) {
      return wanted(draw).every(([c, t]) => store.use(meta, c, t) !== undefined);
    },

    // Loads what the draw needs and reports { done, total } for those frames.
    // With ahead > 0 it also warms the frame that many steps later, without reporting.
    async prefetch(draw, ahead = 0, onProgress) {
      const needed = wanted(draw);
      let done = 0;
      onProgress?.({ done, total: needed.length });

      await Promise.all(
        needed.map(([c, t]) =>
          store.load(meta, c, t).then((frame) => {
            done++;
            onProgress?.({ done, total: needed.length });
            return frame;
          })
        )
      );

      const next = draw.frame + ahead;
      if (ahead > 0 && next < meta.nt) {
        wanted({ ...draw, frame: next }).forEach(([c, t]) => {
          store.load(meta, c, t).catch(() => {});
        });
      }
    },
  };
}

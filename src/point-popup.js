// The point popup: what a query result shows, and the card built from it.
// Only the card builder touches the DOM; opening the popup on the map — and
// updating it in place — stays in map.js.

import { formatTime } from './clock.js';
import { SPARK_HEIGHT, SPARK_WIDTH, curveLabels, markerX, sparklinePath } from './sparkline.js';
import { MS_TO_KNOTS } from './speed-scale.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// What the popup shows for a point-query result:
// kind 'current' — the speed and bearing at the tapped moment, plus
//   progress { done, total } while the curve is still loading, or
//   curve { series, maxSpeed } once the curve has fully loaded;
// kind 'note' — a plain status line, with the error's own text when it has one.
export function pointPopupPlan(result) {
  const { status } = result;

  if (status === 'ready' || status === 'current' || status === 'curve') {
    return {
      kind: 'current',
      current: result.current,
      progress: status === 'curve' ? { done: result.done, total: result.total } : null,
      curve: status === 'ready' && result.series.length > 1 ? { series: result.series, maxSpeed: result.maxSpeed } : null,
    };
  }

  const notes = {
    loading: 'busy.framesOne',
    outside: 'point.outside',
    noTide: 'point.noTide',
    land: 'point.land',
  };

  return {
    kind: 'note',
    // An error may carry its own message; anything unknown is a plain error.
    key: notes[status] ?? 'point.error',
    text: status === 'error' ? (result.message ?? null) : null,
  };
}

// The speed curve with the time marker at the start (the clicked moment).
function sparkline(series) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SPARK_WIDTH + 8} ${SPARK_HEIGHT + 4}`);
  svg.setAttribute('class', 'point-popup-spark');
  svg.setAttribute('aria-hidden', 'true');

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('transform', 'translate(4 2)');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', sparklinePath(series.map((point) => point.speed), SPARK_WIDTH, SPARK_HEIGHT, { min: 0 }));
  group.append(path);

  // markerX(0) puts the marker at the clicked time, the first point of the series.
  const marker = document.createElementNS(SVG_NS, 'line');
  marker.setAttribute('class', 'point-popup-marker');
  marker.setAttribute('x1', markerX(0, series.length, SPARK_WIDTH));
  marker.setAttribute('x2', markerX(0, series.length, SPARK_WIDTH));
  marker.setAttribute('y1', 0);
  marker.setAttribute('y2', SPARK_HEIGHT);
  group.append(marker);

  svg.append(group);
  return svg;
}

// The labels under the curve: the strongest speed top-right, the span, and the caption.
function curveLabelsBlock(series, { t, number, offsetMinutes }) {
  const labels = curveLabels(
    series,
    (speed) => speed * MS_TO_KNOTS,
    (ms) => formatTime(ms, offsetMinutes)
  );

  const times = element('div', 'point-popup-times');
  times.append(element('span', null, labels.start), element('span', null, labels.end));

  return [
    element('p', 'point-popup-peak', `${number(labels.max, 2)} ${t('unit.kn')}`),
    times,
    element('p', 'point-popup-caption', t('point.curveCaption')),
  ];
}

// The card shown in the popup. i18n is { t, number, offsetMinutes } and is read
// now, so the popup speaks the language of the moment it is built.
export function pointPopupCard(result, i18n) {
  const { t, number, offsetMinutes } = i18n;
  const plan = pointPopupPlan(result);
  const box = element('div', 'point-popup-card');

  if (plan.kind === 'note') {
    box.append(element('p', 'point-popup-note', plan.text ?? t(plan.key)));
    return box;
  }

  const { current } = plan;
  box.append(
    element(
      'p',
      'point-popup-speed',
      `${number(current.speed * MS_TO_KNOTS, 2)} ${t('unit.kn')} · ${t('tooltip.set')} ${Math.round(current.bearing)}°`
    )
  );

  if (plan.progress) {
    box.append(element('p', 'point-popup-note', t('point.progress', plan.progress)));
  } else if (plan.curve) {
    const { series, maxSpeed } = plan.curve;
    box.append(
      element('p', 'point-popup-max', t('point.max', { value: number(maxSpeed * MS_TO_KNOTS, 2), unit: t('unit.kn') }))
    );
    box.append(sparkline(series));
    box.append(...curveLabelsBlock(series, { t, number, offsetMinutes }));
  }

  return box;
}

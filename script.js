"use strict";

const positionFormatter = new Intl.NumberFormat("ja-JP", {
  minimumIntegerDigits: 3,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const forceFormatter = new Intl.NumberFormat("ja-JP", {
  minimumIntegerDigits: 1,
  minimumFractionDigits: 8,
  maximumFractionDigits: 8,
});

const sheetScale = devicePixelRatio;

/** @type {(force: number) => number} */
const force2color = (force) =>
  Math.max(0, Math.floor((1 - force) ** 2 * 255 - 8));

const main = () => {
  document.addEventListener("dblclick", (event) => event.preventDefault());

  const positionElement = document.getElementById("position");
  if (!(positionElement instanceof HTMLDivElement)) throw new Error();

  const inform = {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} force
     */
    position: (x, y, force) => {
      x = positionFormatter.format(x);
      y = positionFormatter.format(y);
      force = forceFormatter.format(force);
      positionElement.innerHTML = `(${x}, ${y}): force = ${force}`;
    },
  };

  const getDrawType = () => {
    return ["point", "line", "bezier"].find(
      (t) => document.getElementById(`draw-${t}`)?.checked
    );
  };

  const timeHistogramElement = document.getElementById("time-histogram");
  if (!(timeHistogramElement instanceof HTMLCanvasElement)) throw new Error();

  const timeHistogram = new Chart(timeHistogramElement, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ label: "時間間隔 [ms]", data: [] }],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      responsive: true,
    },
  });

  const sheetElement = document.getElementById("sheet");
  if (!(sheetElement instanceof HTMLCanvasElement)) throw new Error();

  (() => {
    const sheetContainerElement = document.getElementById("sheet-container");
    if (!(sheetContainerElement instanceof HTMLDivElement)) throw new Error();

    const { width, height } = sheetContainerElement.getBoundingClientRect();
    sheetElement.style.width = `${width}px`;
    sheetElement.style.height = `${height}px`;
    sheetElement.width = width * sheetScale;
    sheetElement.height = height * sheetScale;
  })();

  const ctx = sheetElement.getContext("2d");
  if (!ctx) throw new Error("canvas 2d is not supported");

  ctx.scale(sheetScale, sheetScale);

  /** @type {{ x: number, y: number, force: number, date: number }[][]} */
  const strokes = [];

  /** @type {(touch: Touch) => void} */
  const addPointToLatestStroke = (touch) => {
    const sheetRect = sheetElement.getBoundingClientRect();

    const x = touch.clientX - sheetRect.left;
    const y = touch.clientY - sheetRect.top;
    const { force } = touch;

    if (!(0 <= x && x < sheetRect.width) || !(0 <= y && y < sheetRect.height)) {
      return false;
    }

    const currentStroke = strokes[strokes.length - 1];
    currentStroke.push({ x, y, force, date: Date.now() });

    inform.position(x, y, force);

    return true;
  };

  let isTouching = false;

  /** @type {(touch: Touch) => void} */
  const startStroke = (touch) => {
    isTouching = true;

    strokes.push([]);
    addPointToLatestStroke(touch);
  };

  const endStroke = () => {
    isTouching = false;

    /**
     * 時間間隔ヒストグラムの描画
     */
    const dateDiffs = strokes.flatMap((stroke) =>
      stroke
        .map((point) => point.date)
        .map((_, i, array) => array[i] - array[i - 1])
        .splice(1)
    );

    let labels = Array.from(new Set(dateDiffs));
    labels.sort((a, b) => a - b);
    timeHistogram.data.labels = labels;

    const data = Array(labels.length).fill(0);
    dateDiffs.forEach((d) => data[d]++);

    timeHistogram.data.datasets[0].data = data;

    timeHistogram.update();
  };

  sheetElement.addEventListener("touchstart", (event) => {
    if (isTouching) throw new Error();

    if (event.touches.length === 0) throw new Error();

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (touch.touchType !== "stylus") return;

    event.preventDefault();

    startStroke(touch);
  });

  sheetElement.addEventListener("touchend", (event) => {
    if (!isTouching) return;

    event.preventDefault();

    endStroke();
  });

  sheetElement.addEventListener("touchmove", (event) => {
    if (!isTouching) return;

    event.preventDefault();

    const touch = event.touches[0];

    const isAdded = addPointToLatestStroke(touch);
    if (!isAdded) {
      endStroke();
    }
  });

  const loop = async () => {
    /**
     * シート描画
     */
    ctx.clearRect(0, 0, sheetElement.width, sheetElement.height);

    const drawType = getDrawType();

    if (drawType === "point") {
      strokes.forEach((stroke) => {
        stroke.forEach(({ x, y, force }) => {
          ctx.beginPath();

          const color = force2color(force);
          ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;

          ctx.arc(x, y, 4, 0, Math.PI * 2);

          ctx.fill();

          ctx.closePath();
        });
      });
    } else if (drawType === "line") {
      strokes.forEach((stroke) => {
        [...new Array(stroke.length - 1).keys()].forEach((i) => {
          const { x: x0, y: y0, force: force0 } = stroke[i];
          const { x: x1, y: y1, force: force1 } = stroke[i + 1];

          ctx.beginPath();

          const color = force2color((force0 + force1) / 2);
          ctx.strokeStyle = `rgb(${color}, ${color}, ${color})`;
          ctx.lineWidth = 2;

          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();

          ctx.closePath();
        });
      });
    } else if (drawType === "bezier") {
      strokes.forEach((stroke) => {
        ctx.beginPath();

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;

        [...new Array(stroke.length - 1).keys()].forEach((i) => {
          const { x: x0, y: y0 } = stroke[i];
          const { x: x1, y: y1 } = stroke[i + 1];

          ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        });

        const lastStroke = stroke[stroke.length - 1];
        ctx.lineTo(lastStroke.x, lastStroke.y);

        ctx.stroke();

        ctx.closePath();
      });
    } else {
      throw new Error(`unknown draw type: ${drawType}`);
    }

    requestAnimationFrame(loop);
  };
  loop();
};

main();

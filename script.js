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

const sheetSize = {
  width: 512,
  height: 512,
};

const sheetScale = devicePixelRatio;

const maxLogSize = 64;

const dotRadius = 4;

const main = () => {
  document.addEventListener("dblclick", (event) => event.preventDefault());

  const statusElement = document.getElementById("status");
  if (!(statusElement instanceof HTMLDivElement)) throw new Error();

  const positionElement = document.getElementById("position");
  if (!(positionElement instanceof HTMLDivElement)) throw new Error();

  const inform = {
    /**
     *
     * @param {"info" | "error"} type
     * @param {string} message
     */
    status: (type, message) => {
      statusElement.classList.remove(...statusElement.classList);
      statusElement.classList.add(type);
      statusElement.innerHTML = message;
    },

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

  const sheetElement = document.getElementById("sheet");
  if (!(sheetElement instanceof HTMLCanvasElement)) throw new Error();

  sheetElement.style.width = `${sheetSize.width}px`;
  sheetElement.style.height = `${sheetSize.height}px`;
  sheetElement.width = sheetSize.width * sheetScale;
  sheetElement.height = sheetSize.height * sheetScale;

  const ctx = sheetElement.getContext("2d");
  if (!ctx) throw new Error("canvas 2d is not supported");

  ctx.scale(sheetScale, sheetScale);

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} force
   */
  const plot = (x, y, force) => {
    const color = Math.max(0, Math.floor((1 - force) ** 2 * 255 - 8));
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
    ctx.fill();
    ctx.closePath();
  };

  let isTouching = false;

  sheetElement.addEventListener("touchstart", (event) => {
    if (isTouching) throw new Error();

    if (event.touches.length === 0) throw new Error();

    if (event.touches.length !== 1) {
      inform.status("error", "multi touch is not supported");
      return;
    }

    const { touchType } = event.touches[0];
    if (touchType !== "stylus") {
      inform.status("error", "touch type is not stylus");
      return;
    }

    event.preventDefault();

    isTouching = true;
    inform.status("info", `touch start (${touchType})`);
  });

  sheetElement.addEventListener("touchend", (event) => {
    if (!isTouching) return;

    event.preventDefault();

    isTouching = false;
    inform.status("info", `touch end`);
  });

  sheetElement.addEventListener("touchmove", (event) => {
    if (!isTouching) return;

    event.preventDefault();

    const touch = event.touches[0];
    const sheetRect = sheetElement.getBoundingClientRect();

    const x = touch.clientX - sheetRect.left;
    const y = touch.clientY - sheetRect.top;
    const { force } = touch;

    if (!(0 <= x && x < sheetRect.width) || !(0 <= y && y < sheetRect.height)) {
      isTouching = false;
      inform.status("error", "outside of the sheet");
    }

    plot(x, y, force);
    inform.position(x, y, force);
  });
};

main();

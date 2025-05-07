const vtkPiecewiseGaussianWidget = vtk.Interaction.Widgets.vtkPiecewiseGaussianWidget;
const macro = vtk.macro
export const Mode = {
  Gaussians: 1,
  Points: 2,
};

export const ADJUST_POSITION_CURSOR = '-webkit-grab';

/**
 * Samples a piecewise linear function at regular intervals in [0,1].
 * The first and last values are set to zero, since the output
 * is used for vtkPiecewiseGaussianWidget.drawChart().
 *
 * Assumes normalized x/y coordinate points.
 */

export function samplePiecewiseLinear(points, shift = 0, samples = 256) {
  const filledPoints = [...points];
  // set endpoints to drop to 0
  filledPoints.push([points[0][0], 0]);
  filledPoints.push([points[points.length - 1][0], 0]);

  const sampledPoints = [];
  let pi = 0;
  let p1 = filledPoints[0]; // left
  let p2 = filledPoints[1]; // right
  let slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
  for (let i = 0; i < samples; i += 1) {
    const sx = i / (samples - 1) - shift; // sample x
    if (i < samples - 1) {
      while (sx > p2[0] && pi < filledPoints.length - 2) {
        pi += 1;
        // extraneous work if this loop goes over more than once,
        // which only happens if sx > 0 on first iteration (aka shift < 0)
        p1 = filledPoints[pi];
        p2 = filledPoints[pi + 1];
        if (Math.abs(p2[0] - p1[0]) < 1e-8) {
          slope = Infinity * Math.sign(p2[1] - p1[1]);
        } else {
          slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
        }
      }
      if (slope === Infinity) {
        sampledPoints.push(1);
      } else if (slope === -Infinity) {
        sampledPoints.push(0);
      } else {
        sampledPoints.push(slope * (sx - p1[0]) + p1[1]);
      }
    }
  }
  return sampledPoints;
}

// ----------------------------------------------------------------------------
// vtkPiecewiseWidget methods
// ----------------------------------------------------------------------------

function vtkPiecewiseWidget(publicAPI, model) {
  model.classHierarchy.push('vtkPiecewiseWidget');

  const superClass = { ...publicAPI };

  model.pwMode = Mode.Gaussians;
  model.opacityPoints = [];
  model.opacityPointShift = 0;

  publicAPI.setGaussiansMode = () => {
    model.pwMode = Mode.Gaussians;
  };

  publicAPI.setPointsMode = () => {
    // clear gaussians so we don't keep this ref around
    model.gaussians = [];
    model.pwMode = Mode.Points;
  };

  publicAPI.isModeGaussians = () => model.pwMode === Mode.Gaussians;
  publicAPI.isModePoints = () => model.pwMode === Mode.Points;
  publicAPI.getMode = () => model.pwMode;

  publicAPI.shiftPosition = (coords, meta) => {
    model.opacityPointShift =
      meta.originalOpacityPointShift + coords[0] - meta.originalXY[0];
    return true;
  };

  publicAPI.onHover = (x, y) => {
    if (publicAPI.isModeGaussians()) {
      return superClass.onHover(x, y);
    }
    model.canvas.style.cursor = ADJUST_POSITION_CURSOR;
    return true;
  };

  publicAPI.onClick = (x, y) => {
    if (publicAPI.isModeGaussians()) {
      return superClass.onClick(x, y);
    }
    return undefined;
  };

  publicAPI.onDown = (x, y) => {
    if (publicAPI.isModeGaussians()) {
      return superClass.onDown(x, y);
    }

    if (!model.mouseIsDown) {
      publicAPI.invokeAnimation(true);
    }

    const mouseCoords = vtkPiecewiseGaussianWidget.normalizeCoordinates(
      x,
      y,
      model.graphArea
    );

    model.mouseIsDown = true;
    model.activeGaussian = -1;
    model.dragAction = {
      originalXY: mouseCoords,
      originalOpacityPointShift: model.opacityPointShift,
    };

    return true;
  };

  publicAPI.onDrag = (x, y) => {
    if (publicAPI.isModeGaussians()) {
      return superClass.onDrag(x, y);
    }

    const normCoords = vtkPiecewiseGaussianWidget.normalizeCoordinates(
      x,
      y,
      model.graphArea
    );
    if (publicAPI.shiftPosition(normCoords, model.dragAction)) {
      model.opacities = samplePiecewiseLinear(
        model.opacityPoints,
        model.opacityPointShift
      );
      publicAPI.invokeOpacityChange(publicAPI, true);
    }

    publicAPI.modified();
    return true;
  };

  publicAPI.setOpacityPoints = (points, shift = 0) => {
    if (publicAPI.isModePoints()) {
      // deep copy
      model.opacityPoints = points.map((p) => [p[0], p[1]]);
      model.opacityPointShift = shift;

      model.opacities = samplePiecewiseLinear(
        model.opacityPoints,
        model.opacityPointShift
      );
      publicAPI.modified();
    }
  };

  publicAPI.getEffectiveOpacityPoints = () =>
    model.opacityPoints.map((p) => [p[0] + model.opacityPointShift, p[1]]);

  publicAPI.render = () => {
    if (publicAPI.isModePoints()) {
      model.activeGaussian = -1;
      model.selectedGaussian = -1;
    }
    superClass.render();
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkPiecewiseGaussianWidget.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['opacityPoints', 'opacityPointShift']);

  // Object specific methods
  vtkPiecewiseWidget(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkPiecewiseWidget');

// ----------------------------------------------------------------------------

export default { newInstance, extend };

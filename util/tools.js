export function invert3x3 (m) {
  const a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
  const a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
  const a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  const det = a00 * b01 + a01 * b11 + a02 * b21;

  if (Math.abs(det) < 1e-8) {
    throw new Error("Matrix is not invertible");
  }

  const invDet = 1.0 / det;

  return [
    [
      b01 * invDet,
      (-a22 * a01 + a02 * a21) * invDet,
      (a12 * a01 - a02 * a11) * invDet,
    ],
    [
      b11 * invDet,
      (a22 * a00 - a02 * a20) * invDet,
      (-a12 * a00 + a02 * a10) * invDet,
    ],
    [
      b21 * invDet,
      (-a21 * a00 + a01 * a20) * invDet,
      (a11 * a00 - a01 * a10) * invDet,
    ],
  ];
}

export function multiplyMatVec (m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function worldToImage (imageData, worldCoord) {
  const origin = imageData.getOrigin();
  const spacing = imageData.getSpacing();
  const dir = imageData.getDirection();
  // console.log('test origin: ', origin);
  // console.log('test spacing: ', spacing);
  // console.log('test dir: ', dir);
  // console.log('test extent: ', imageData.getExtent());
  // console.log('test dims: ', imageData.getDimensions());
  // console.log('test spacing: ', imageData.getSpacing());

  // 按列顺序重建方向矩阵（列主序解构）
  const D = [
    [dir[0], dir[1], dir[2]], // X轴方向
    [dir[3], dir[4], dir[5]], // Y轴方向
    [dir[6], dir[7], dir[8]], // Z轴方向
  ];

  // M = D * diag(spacing)
  const M = [
    [D[0][0] * spacing[0], D[0][1] * spacing[1], D[0][2] * spacing[2]],
    [D[1][0] * spacing[0], D[1][1] * spacing[1], D[1][2] * spacing[2]],
    [D[2][0] * spacing[0], D[2][1] * spacing[1], D[2][2] * spacing[2]],
  ];

  const delta = [
    worldCoord[0] - origin[0],
    worldCoord[1] - origin[1],
    worldCoord[2] - origin[2],
  ];

  const M_inv = invert3x3(M);
  const ijkFloat = multiplyMatVec(M_inv, delta);

  return ijkFloat;
}

export function worldToImage1 (worldCoord, origin, spacing, direction = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1
]) {
  // direction默认单位矩阵

  // 按列顺序重建方向矩阵（列主序解构）
  const D = [
    [direction[0], direction[1], direction[2]],   // X轴方向
    [direction[3], direction[4], direction[5]],   // Y轴方向
    [direction[6], direction[7], direction[8]],   // Z轴方向
  ];

  // M = D * diag(spacing)
  const M = [
    [D[0][0] * spacing[0], D[0][1] * spacing[1], D[0][2] * spacing[2]],
    [D[1][0] * spacing[0], D[1][1] * spacing[1], D[1][2] * spacing[2]],
    [D[2][0] * spacing[0], D[2][1] * spacing[1], D[2][2] * spacing[2]],
  ];

  const delta = [
    worldCoord[0] - origin[0],
    worldCoord[1] - origin[1],
    worldCoord[2] - origin[2],
  ];

  const M_inv = invert3x3(M);
  const ijkFloat = multiplyMatVec(M_inv, delta);

  return ijkFloat;
}
// 获取合法中心点, 确保生成的 world 点在当前图像 volume 的合法范围内
export function getImageCenterWorld (imageData) {
  const extent = imageData.getExtent(); // [xMin, xMax, yMin, yMax, zMin, zMax]
  const spacing = imageData.getSpacing(); // [sx, sy, sz]
  const origin = imageData.getOrigin();   // [ox, oy, oz]
  const direction = imageData.getDirection(); // 3x3 matrix flat

  // 图像中心的索引坐标
  const centerIJK = [
    (extent[0] + extent[1]) / 2,
    (extent[2] + extent[3]) / 2,
    (extent[4] + extent[5]) / 2,
  ];

  // 构造方向矩阵
  const D = [
    direction.slice(0, 3),
    direction.slice(3, 6),
    direction.slice(6, 9),
  ];

  // 乘 spacing
  const scaled = [
    centerIJK[0] * spacing[0],
    centerIJK[1] * spacing[1],
    centerIJK[2] * spacing[2],
  ];

  // D * scaled
  const Ds = [
    D[0][0] * scaled[0] + D[0][1] * scaled[1] + D[0][2] * scaled[2],
    D[1][0] * scaled[0] + D[1][1] * scaled[1] + D[1][2] * scaled[2],
    D[2][0] * scaled[0] + D[2][1] * scaled[1] + D[2][2] * scaled[2],
  ];

  return [
    origin[0] + Ds[0],
    origin[1] + Ds[1],
    origin[2] + Ds[2],
  ];
}
// 计算射线与AABB盒子相交的函数，返回两个交点，或者null
export function intersectRayAABB (origin, dir, bounds) {
  // 方向向量的倒数，避免除零
  const invDir = dir.map(d => (Math.abs(d) < 1e-10 ? 1e10 : 1 / d));

  const tmin = (bounds[0] - origin[0]) * invDir[0];
  const tmax = (bounds[1] - origin[0]) * invDir[0];
  const tymin = (bounds[2] - origin[1]) * invDir[1];
  const tymax = (bounds[3] - origin[1]) * invDir[1];
  const tzmin = (bounds[4] - origin[2]) * invDir[2];
  const tzmax = (bounds[5] - origin[2]) * invDir[2];

  const t1 = Math.min(tmin, tmax);
  const t2 = Math.max(tmin, tmax);
  const ty1 = Math.min(tymin, tymax);
  const ty2 = Math.max(tymin, tymax);
  const tz1 = Math.min(tzmin, tzmax);
  const tz2 = Math.max(tzmin, tzmax);

  const tEnter = Math.max(t1, ty1, tz1);
  const tExit = Math.min(t2, ty2, tz2);

  if (tEnter > tExit || tExit < 0) {
    // 不相交
    return null;
  }

  const pEnter = origin.map((o, i) => o + dir[i] * tEnter);
  const pExit = origin.map((o, i) => o + dir[i] * tExit);
  return [pEnter, pExit];
}

// 把 image 坐标（ijk）转为 canvas 坐标
export function imageToCanvas (imageCoord, viewport, lineAxes) {
  const canvas = viewport.container.querySelector('canvas');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const imageData = viewport.imageData;
  const dims = imageData.getDimensions();
  const direction = imageData.getDirection();

  const [axisI, axisJ] = lineAxes;

  const extentI = dims[axisI];
  const extentJ = dims[axisJ];

  // 确保imageCoord在有效范围内（强制裁剪）
  let i = Math.min(Math.max(imageCoord[axisI], 0), extentI - 1);
  let j = Math.min(Math.max(imageCoord[axisJ], 0), extentJ - 1);

  // 方向矩阵的翻转判断（只针对对角元素负值）
  const flipI = direction[axisI * 3 + axisI] < 0 ? -1 : 1;
  const flipJ = direction[axisJ * 3 + axisJ] < 0 ? -1 : 1;

  if (flipI === -1) i = extentI - 1 - i;
  if (flipJ === -1) j = extentJ - 1 - j;

  // 计算缩放比例
  const scaleX = canvasWidth / extentI;
  const scaleY = canvasHeight / extentJ;

  // 注意canvas原点左上，y向下，所以j无需额外反转
  const xCanvas = i * scaleX;
  const yCanvas = j * scaleY;

  // 额外限制canvas坐标不超出边界
  const xClamped = Math.min(Math.max(xCanvas, 0), canvasWidth);
  const yClamped = Math.min(Math.max(yCanvas, 0), canvasHeight);

  return [xClamped, yClamped];
}






export function imageToCanvas1 (imageCoord, canvasWidth, canvasHeight, dims, spacing) {

  // 固定切面为 transverse，对应 ij 轴
  const axisI = 1;
  const axisJ = 2;

  const i = imageCoord[axisI];
  const j = imageCoord[axisJ];

  // 实际图像尺寸（mm）
  const extentI = dims[axisI] * spacing[axisI];
  const extentJ = dims[axisJ] * spacing[axisJ];

  // 把 image 坐标（i,j）中心化，映射到 canvas 坐标
  const centerI = dims[axisI] / 2;
  const centerJ = dims[axisJ] / 2;

  // 平移到中心 + 缩放到 canvas
  const xNorm = (i - centerI) * spacing[axisI];
  const yNorm = (j - centerJ) * spacing[axisJ];

  const scaleX = canvasWidth / extentI;
  const scaleY = canvasHeight / extentJ;

  // 翻转 y 轴
  const xCanvas = canvasWidth / 2 + xNorm * scaleX;
  const yCanvas = canvasHeight / 2 - yNorm * scaleY;

  return [xCanvas, yCanvas];
}
// 根据法向量与viewUp生成局部坐标轴
export function getNewAxesFromPlane (center, normal, viewUp) {
  const zLen = Math.hypot(...normal);
  const newZ = normal.map(n => n / zLen);

  const dot = viewUp[0] * newZ[0] + viewUp[1] * newZ[1] + viewUp[2] * newZ[2];
  const proj = newZ.map(n => n * dot);
  const rawY = [
    viewUp[0] - proj[0],
    viewUp[1] - proj[1],
    viewUp[2] - proj[2],
  ];
  const yLen = Math.hypot(...rawY);
  const newY = rawY.map(n => n / yLen);

  const newX = [
    newY[1] * newZ[2] - newY[2] * newZ[1],
    newY[2] * newZ[0] - newY[0] * newZ[2],
    newY[0] * newZ[1] - newY[1] * newZ[0],
  ];

  return { newX, newY, newZ, newCenter: center };
}
export function setMapperActor (mapper, scalarRange, ww, wl, vtk) {
  const [minScalar, maxScalar] = scalarRange;
  if (!ww || !wl || isNaN(ww) || isNaN(wl)) {
    wl = (maxScalar + minScalar) / 2;
    ww = (maxScalar - minScalar) / 2;
  }

  const rangeMin = wl - ww * 2;
  const rangeMax = wl + ww * 2;

  const ctfun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
  ctfun.removeAllPoints();
  ctfun.addRGBPoint(rangeMin, 0.0, 0.0, 0.0);
  ctfun.addRGBPoint(wl - ww / 2, 0.3, 0.3, 0.3);
  ctfun.addRGBPoint(wl, 1.0, 1.0, 1.0);
  ctfun.addRGBPoint(wl + ww / 2, 1.0, 1.0, 1.0);
  ctfun.addRGBPoint(rangeMax, 1.0, 1.0, 1.0);

  const ofun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
  ofun.removeAllPoints();
  ofun.addPoint(rangeMin, 0.0);
  ofun.addPoint(wl - ww / 2, 0.15);
  ofun.addPoint(wl, 0.6);
  ofun.addPoint(wl + ww / 2, 1.0);
  ofun.addPoint(rangeMax, 1.0);

  const volumeProperty = vtk.Rendering.Core.vtkVolumeProperty.newInstance();
  volumeProperty.setInterpolationTypeToLinear();
  volumeProperty.setRGBTransferFunction(0, ctfun);
  volumeProperty.setScalarOpacity(0, ofun);
  volumeProperty.setShade(false);
  volumeProperty.setAmbient(0.2);
  volumeProperty.setDiffuse(0.7);
  volumeProperty.setSpecular(0.0);

  const volumeActor = vtk.Rendering.Core.vtkVolume.newInstance();
  volumeActor.setMapper(mapper);
  volumeActor.setProperty(volumeProperty);

  return volumeActor;
}

export function getScalarRange (scalars) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < scalars.length; i++) {
    const val = scalars[i];
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return [min, max];
}
export function canvasToImage (x, y, viewport, axisMap) {
  const canvas = viewport.container.querySelector('canvas');
  const dims = viewport.imageData.getDimensions();
  const spacing = viewport.imageData.getSpacing();

  const imageWidth = dims[axisMap[0]];
  const imageHeight = dims[axisMap[1]];

  const scaleX = imageWidth / canvas.width;
  const scaleY = imageHeight / canvas.height;

  const i = x * scaleX;
  const j = y * scaleY;

  return [i, j];
}

export function imageToWorld (imageData, ijk) {
  const spacing = imageData.getSpacing();
  const origin = imageData.getOrigin();

  return [
    origin[0] + ijk[0] * spacing[0],
    origin[1] + ijk[1] * spacing[1],
    origin[2] + ijk[2] * spacing[2],
  ];
}


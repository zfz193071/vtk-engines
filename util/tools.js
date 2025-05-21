const { vec3 } = glMatrix
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
// 计算方向在体积内的最大正负延伸长度
export function getLineWithinBounds (center, dir, bounds) {
  let minT = -Infinity;
  let maxT = Infinity;

  for (let i = 0; i < 3; i++) {
    const origin = center[i];
    const d = dir[i];

    if (Math.abs(d) < 1e-6) continue;

    const t1 = (bounds[i * 2] - origin) / d;
    const t2 = (bounds[i * 2 + 1] - origin) / d;

    const tMin = Math.min(t1, t2);
    const tMax = Math.max(t1, t2);

    minT = Math.max(minT, tMin);
    maxT = Math.min(maxT, tMax);
  }

  if (minT > maxT) {
    return null;
  }

  // 修复：确保返回的线段以 center 为中点，方向对称展开
  const halfLength = Math.min(maxT, -minT);
  const p1 = center.map((c, i) => c - dir[i] * halfLength);
  const p2 = center.map((c, i) => c + dir[i] * halfLength);
  return [p1, p2];
}


export function getAxisMapFromCamera (viewport) {
  const camera = viewport.renderer.getActiveCamera();
  const viewPlaneNormal = camera.getDirectionOfProjection(); // 朝向
  const viewUp = camera.getViewUp(); // 上方向

  // 找到 viewUp 最接近 image 坐标系哪个轴
  const absViewUp = viewUp.map(Math.abs);
  const upIndex = absViewUp.indexOf(Math.max(...absViewUp));

  // canvas 的 y 对应于 image 的哪个轴
  // canvas 的 x 是垂直于 viewPlaneNormal 和 viewUp 的方向
  const right = [
    viewPlaneNormal[1] * viewUp[2] - viewPlaneNormal[2] * viewUp[1],
    viewPlaneNormal[2] * viewUp[0] - viewPlaneNormal[0] * viewUp[2],
    viewPlaneNormal[0] * viewUp[1] - viewPlaneNormal[1] * viewUp[0],
  ];
  const absRight = right.map(Math.abs);
  const rightIndex = absRight.indexOf(Math.max(...absRight));

  return [rightIndex, upIndex]; // [canvasX, canvasY]
}


// export function worldToImage (imageData, worldCoord) {
//   const origin = imageData.getOrigin();
//   const spacing = imageData.getSpacing();
//   const dir = imageData.getDirection();
//   // console.log('test origin: ', origin);
//   // console.log('test spacing: ', spacing);
//   // console.log('test dir: ', dir);
//   // console.log('test extent: ', imageData.getExtent());
//   console.log('test dims: ', imageData.getDimensions());
//   // console.log('test spacing: ', imageData.getSpacing());

//   // 按列顺序重建方向矩阵（列主序解构）
//   const D = [
//     [dir[0], dir[1], dir[2]], // X轴方向
//     [dir[3], dir[4], dir[5]], // Y轴方向
//     [dir[6], dir[7], dir[8]], // Z轴方向
//   ];

//   // M = D * diag(spacing)
//   const M = [
//     [D[0][0] * spacing[0], D[0][1] * spacing[1], D[0][2] * spacing[2]],
//     [D[1][0] * spacing[0], D[1][1] * spacing[1], D[1][2] * spacing[2]],
//     [D[2][0] * spacing[0], D[2][1] * spacing[1], D[2][2] * spacing[2]],
//   ];

//   const delta = [
//     worldCoord[0] - origin[0],
//     worldCoord[1] - origin[1],
//     worldCoord[2] - origin[2],
//   ];

//   const M_inv = invert3x3(M);
//   const ijkFloat = multiplyMatVec(M_inv, delta);

//   return ijkFloat;
// }

export function worldToImage (worldCoord, viewport) {
  const [Wx, Wy, Wz] = worldCoord;
  const [Cx, Cy, Cz] = [-0.5, -20, 30];

  const delta = [
    Wx - Cx,
    Wy - Cy,
    Wz - Cz,
  ];

  const plane = viewport.plane;
  const planeName = plane.name;
  const normal = plane.normal;
  const viewUp = plane.viewUp;

  let u = vtk.Common.Core.vtkMath.cross(viewUp, normal, []);

  let v = vtk.Common.Core.vtkMath.cross(normal, u, []);

  // 动态获取spacing
  const spacing = [0.5469, 0.5469, 5.538457307692307];
  let dx, dy;
  if (planeName === "transverse") {
    dx = spacing[0];
    dy = spacing[1];
  } else if (planeName === "coronal") {
    dx = spacing[0];
    dy = spacing[2];
  } else if (planeName === "sagittal") {
    dx = spacing[1];
    dy = spacing[2];
  } else {
    dx = dy = 1; // 默认防护
  }

  const size = [512, 512, 26];
  let width, height;
  if (planeName === "transverse") {
    width = size[0];
    height = size[1];
  } else if (planeName === "coronal") {
    width = size[0];
    height = size[2];
  } else if (planeName === "sagittal") {
    width = size[1];
    height = size[2];
  } else {
    width = height = 1;
  }

  const uVal = vtk.Common.Core.vtkMath.dot(delta, u);
  const vVal = vtk.Common.Core.vtkMath.dot(delta, v);

  // 图像坐标转换
  const imageU = (uVal / dx) + width / 2;
  const imageV = height / 2 - (vVal / dy);  // 反转Y轴，适配图像坐标向下

  return [imageU, imageV];
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
  // 构造一个通过 origin、沿 dir 方向的线段，而不是半无限射线
  const p1 = origin.map((o, i) => o - dir[i] * 10000);
  const p2 = origin.map((o, i) => o + dir[i] * 10000);

  const tMin = [];
  const tMax = [];

  for (let i = 0; i < 3; i++) {
    const d = p2[i] - p1[i];
    if (Math.abs(d) < 1e-10) {
      // 射线平行轴
      if (p1[i] < bounds[i * 2] || p1[i] > bounds[i * 2 + 1]) return null;
      tMin[i] = -Infinity;
      tMax[i] = Infinity;
    } else {
      const t1 = (bounds[i * 2] - p1[i]) / d;
      const t2 = (bounds[i * 2 + 1] - p1[i]) / d;
      tMin[i] = Math.min(t1, t2);
      tMax[i] = Math.max(t1, t2);
    }
  }

  const tEnter = Math.max(tMin[0], tMin[1], tMin[2]);
  const tExit = Math.min(tMax[0], tMax[1], tMax[2]);

  if (tEnter > tExit || tExit < 0) return null;

  const pEnter = p1.map((v, i) => v + (p2[i] - p1[i]) * tEnter);
  const pExit = p1.map((v, i) => v + (p2[i] - p1[i]) * tExit);

  return [pEnter, pExit];
}


// 把 image 坐标（ijk）转为 canvas 坐标
// export function imageToCanvas (imageCoord, viewport, lineAxes) {
//   const canvas = viewport.container.querySelector('canvas');
//   const canvasWidth = canvas.width;
//   const canvasHeight = canvas.height;

//   const imageData = viewport.imageData;
//   const dims = imageData.getDimensions();      // [dimX, dimY, dimZ]
//   const direction = imageData.getDirection();  // 3x3 矩阵

//   const [axisI, axisJ] = lineAxes; // e.g. [0, 2]

//   const extentI = dims[axisI];
//   const extentJ = dims[axisJ];

//   let i = imageCoord[axisI];
//   let j = imageCoord[axisJ];

//   // 按轴判断是否翻转
//   const flipI = direction[axisI * 3 + axisI] < 0 ? -1 : 1;
//   const flipJ = direction[axisJ * 3 + axisJ] < 0 ? -1 : 1;

//   if (flipI === -1) i = extentI - 1 - i;
//   if (flipJ === -1) j = extentJ - 1 - j;

//   // 缩放和偏移计算
//   const imageAspect = extentI / extentJ;
//   const canvasAspect = canvasWidth / canvasHeight;

//   let scale, offsetX = 0, offsetY = 0;

//   if (imageAspect > canvasAspect) {
//     // 横向占满，高度居中
//     scale = canvasWidth / extentI;
//     const imageDisplayHeight = extentJ * scale;
//     offsetY = (canvasHeight - imageDisplayHeight) / 2;
//   } else {
//     // 纵向占满，宽度居中
//     scale = canvasHeight / extentJ;
//     const imageDisplayWidth = extentI * scale;
//     offsetX = (canvasWidth - imageDisplayWidth) / 2;
//   }

//   // ⚠️ 这里关键：I轴 → canvasX, J轴 → canvasY
//   const xCanvas = i * scale + offsetX;
//   const yCanvas = j * scale + offsetY;

//   return [xCanvas, yCanvas];
// }


/**
 * 将图像坐标转换为 canvas 坐标，考虑切面投影。
 * @param {number[]} imageCoord - 图像索引坐标 [i, j, k]
 * @param {object} viewport - 包含 imageData、canvas 等
 * @param {object} plane - 当前视图的切片平面参数（含 normal、viewUp）
 * @param {number[]} center - 当前视图的世界坐标中心
 * @returns {number[]} - [xCanvas, yCanvas]
 */
export function imageToCanvas (imageCoord, viewport) {
  const canvas = viewport.container.querySelector('canvas');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const plane = viewport.plane;
  const center = [-0.5, -20, 30]

  const imageData = viewport.imageData;

  // 1. image index → world position
  const worldCoord = imageData.indexToWorld(imageCoord);

  // 2. 构建切面投影坐标系（基于 normal/viewUp）
  const normal = vec3.normalize([], plane.normal);
  const viewUp = vec3.normalize([], plane.viewUp);
  const viewRight = vec3.normalize([], vec3.cross([], normal, viewUp));

  // 3. 相对 center 的向量（worldCoord - center）
  const relative = vec3.subtract([], worldCoord, center);

  // 4. 投影到切面坐标系：得到 in-plane 坐标
  const xInPlane = vec3.dot(relative, viewRight); // canvas X
  const yInPlane = vec3.dot(relative, viewUp);    // canvas Y

  // 5. 图像尺寸估算（用 spacing & extent）
  const spacing = imageData.getSpacing(); // [sx, sy, sz]
  const dims = imageData.getDimensions(); // [dimX, dimY, dimZ]
  const boundsX = spacing[0] * dims[0];
  const boundsY = spacing[1] * dims[1];
  const boundsZ = spacing[2] * dims[2];

  // 估算切面范围（假设最大展开）
  const planeWidth = Math.max(boundsX, boundsY, boundsZ);
  const planeHeight = planeWidth;

  // 6. 缩放比例和居中偏移（保持比例）
  const imageAspect = planeWidth / planeHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let scale, offsetX = 0, offsetY = 0;
  if (imageAspect > canvasAspect) {
    scale = canvasWidth / planeWidth;
    const displayHeight = planeHeight * scale;
    offsetY = (canvasHeight - displayHeight) / 2;
  } else {
    scale = canvasHeight / planeHeight;
    const displayWidth = planeWidth * scale;
    offsetX = (canvasWidth - displayWidth) / 2;
  }

  // 7. 映射到 canvas 坐标
  const xCanvas = xInPlane * scale + canvasWidth / 2;
  const yCanvas = -yInPlane * scale + canvasHeight / 2;

  return [xCanvas, yCanvas];
}




export function rotateVector (vec, axis, angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dot = vec3.dot(vec, axis);
  const cross = vec3.cross([], axis, vec);

  const rotated = [
    vec[0] * cosA + cross[0] * sinA + axis[0] * dot * (1 - cosA),
    vec[1] * cosA + cross[1] * sinA + axis[1] * dot * (1 - cosA),
    vec[2] * cosA + cross[2] * sinA + axis[2] * dot * (1 - cosA),
  ];

  return rotated;
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


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
  console.log('test origin: ', origin);
  console.log('test spacing: ', spacing);
  console.log('test dir: ', dir);
  console.log('test extent: ', imageData.getExtent());
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


// 把 image 坐标（ijk）转为 canvas 坐标
export function imageToCanvas (imageCoord, viewport, lineAxes) {
  const canvas = viewport.container.querySelector('canvas');
  const [canvasWidth, canvasHeight] = [canvas.width, canvas.height];

  const imageData = viewport.imageData;
  const dims = imageData.getDimensions(); // [x, y, z]

  const [axisI, axisJ] = lineAxes;
  const i = imageCoord[axisI];
  const j = imageCoord[axisJ];

  const extentI = dims[axisI];
  const extentJ = dims[axisJ];

  // 中心索引（体素索引，不是距离）
  const centerI = extentI / 2;
  const centerJ = extentJ / 2;

  // 体素偏移量，相对于中心体素索引的偏移
  const deltaI = i - centerI;
  const deltaJ = j - centerJ;

  // 计算缩放比例（canvas像素/体素数），保证体素单位1映射canvas对应像素
  const scaleX = canvasWidth / extentI;
  const scaleY = canvasHeight / extentJ;

  // 映射为canvas坐标，y方向反转是因为canvas坐标系y向下
  const xCanvas = canvasWidth / 2 + deltaI * scaleX;
  const yCanvas = canvasHeight / 2 - deltaJ * scaleY;

  return [xCanvas, yCanvas];
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

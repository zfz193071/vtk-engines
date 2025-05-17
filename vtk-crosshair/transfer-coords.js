import { worldToImage1, imageToCanvas1 } from "../util/tools.js";
function worldToImageCoord (world, origin, spacing) {
  return [
    (world[0] - origin[0]) / spacing[0],
    (world[1] - origin[1]) / spacing[1],
    (world[2] - origin[2]) / spacing[2],
  ];
}

function imageToCanvasCoord (imageCoord, view) {
  const [i, j, k] = imageCoord;

  switch (view) {
    case 'sagittal':   // 展示YZ平面：Y 为纵轴，Z 为横轴
      return [k, j];
    case 'coronal':    // 展示XZ平面：X 为横轴，Z 为纵轴
      return [i, k];
    case 'axial':      // 展示XY平面：X 为横轴，Y 为纵轴
      return [i, j];
    default:
      throw new Error("Unsupported view");
  }
}

const origin = [0, 0, 0];
const spacing = [1, 1, 5];
const view = 'sagittal'; // 展示YZ切面


const world = [50, 20, 10]; // mm 单位

const imageCoord = worldToImageCoord(world, origin, spacing);
console.log('imageCoord: ', imageCoord);
// 结果为：[50, 20, 2] （注意 z 分辨率为 5mm）

const canvasCoord = imageToCanvasCoord(imageCoord, view);
console.log('canvasCoord: ', canvasCoord);
// sagittal 展示的是 YZ，所以 canvas = [2, 20]


const world1 = [-0.9015999999999735, -24.22059999999999, 208.10146307692307]
const origin1 = [-140.908, -164.227, 2.71689]
const spacing1 = [0.5469, 0.5469, 5.538457307692307]

const world2 = [-0.9015999999999735, -24.22059999999999, -91.89853692307693]

const imageCoord1 = worldToImage1(world1, origin1, spacing1, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
console.log('imageCoord1: ', imageCoord1);

const canvasCoord1 = imageToCanvas1(imageCoord1, 176, 722, [512, 512, 26], spacing1);
console.log('canvasCoord1: ', canvasCoord1);

const imageCoord2 = worldToImage1(world2, origin1, spacing1, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
console.log('imageCoord2: ', imageCoord2);

const canvasCoord2 = imageToCanvas1(imageCoord2, 176, 722, [512, 512, 26], spacing1);
console.log('canvasCoord2: ', canvasCoord2);
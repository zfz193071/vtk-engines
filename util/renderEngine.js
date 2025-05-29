// 处理捕获器相关操作
import CatcherEngine from "./catcherEngine.js";
// 包含图像处理的相关方法
import CIMG from "./cimg.js";
// 用于加载图像
import LOAD from "./loadImg.js";
// 用于存储和管理图像数据及相关信息
import DataWithInfo from "./tDataWithInfo.js";
import {
  getNewAxesFromPlane,
  getLineWithoutBounds,
  getDistanceToSegment,
  rotateVectorAroundAxis,
  getViewNormal,
  normalizeAngle,
  splitLineAtCenterGap,
} from "./tools.js";
// 用于进行 4x4 矩阵操作
const { mat4, vec3 } = glMatrix;

const lineColors = {
  "transverse-xy": "#ff0000",
  "coronal-xz": "#00ff00",
  "sagittal-yz": "#0000ff",
};

class RenderEngine {
  constructor(rootDom, para, GPARA, key) {
    if (!rootDom) return;
    let canvasDom = rootDom.querySelector("canvas");
    let divDom = rootDom.querySelector("div");
    this.#vtkRootDom = divDom;
    this.#GPARA = GPARA;
    this.#plane = GPARA.crossSectionState.planes.find((a) => a.name === key);

    if (!canvasDom) this.#renderCanvas = document.createElement("canvas");
    else this.#renderCanvas = canvasDom;

    this.#imgCanvas = document.createElement("canvas");
    this.#hideCanvas1 = document.createElement("canvas");
    this.#hideCanvas2 = document.createElement("canvas");

    this.#renderContext = this.getContext();
    this.setProps(para);
    // 创建一个全屏渲染窗口实例，将 #vtkRootDom 作为根容器，设置容器样式为高度和宽度均为 100%，背景颜色为黑色

    const fullScreenRenderer =
      vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        rootContainer: this.#vtkRootDom,
        containerStyle: {
          height: "100%",
          width: "100%",
        },
        background: [0, 0, 0],
      });
    let interactor = fullScreenRenderer.getInteractor();
    // 实例 interactorStyle，并移除所有鼠标操作器
    const interactorStyle =
      vtk.Interaction.Style.vtkInteractorStyleManipulator.newInstance();
    interactorStyle.removeAllMouseManipulators();
    // interactor.unbindEvents();
    interactor.setInteractorStyle(interactorStyle);

    // 获取渲染窗口和渲染器，并分别赋值给私有属性 #vtkRenderWindow 和 #vtkRenderer
    this.#vtkRenderWindow = fullScreenRenderer.getRenderWindow();
    this.#vtkRenderer = fullScreenRenderer.getRenderer();

    // 创建一个新的 canvas 元素 #renderCanvas3D，设置其样式为绝对定位，顶部和左侧位置为 0px，
    // 宽度和高度与 #renderCanvas 相同
    this.#renderCanvas3D = document.createElement("canvas");
    this.#renderCanvas3D.style.position = "absolute";
    this.#renderCanvas3D.style.top = "0px";
    this.#renderCanvas3D.style.left = "0px";
    this.#renderCanvas3D.width = this.#renderCanvas.width;
    this.#renderCanvas3D.height = this.#renderCanvas.height;
    this.#vtkRootDom.appendChild(this.#renderCanvas3D);

    // 初始化#catcherEngine
    this.#catcherEngine = new CatcherEngine(this.#renderCanvas3D);
    // 设置全局参数
    this.#catcherEngine.setGPARA(GPARA);
    //初始化catcher的操作
    this.#catcherEngine.setRender(this);

    this.isOrthogonalRotation = false; // 添加开关变量

    this.#key = key;
  }
  setOrthogonalRotation(enabled) {
    this.isOrthogonalRotation = enabled;
  }
  // 声明一系列私有属性，用于存储各种状态和参数，包括捕获器引擎、渲染画布、渲染上下文、渲染窗口、渲染器
  #catcherEngine = null;
  #renderCanvas = null;
  #renderCanvas3D = null;
  #renderContext = null;
  #vtkRootDom = null;
  #vtkRenderWindow = null;
  #vtkRenderer = null;

  // 数据源、裁剪平面、图像数据、像素间距、视图模式、融合透明度
  #vtkSource = null;
  #clipPlane1 = null;
  #clipPlane2 = null;
  #dataWithInfo_base = new DataWithInfo({});
  #dataWithInfo_fusion = new DataWithInfo({});
  #initPixelSpacing = 1;
  #curViewMod = 0;
  #fusionOpacity = 0.5;

  #imgCanvas = null;
  #hideCanvas1 = null;
  #hideCanvas2 = null;
  #GPARA = null;
  #plane = null;
  #key = null;

  #currentRotatePlane = null;
  #currentUnRotatePlane = null;

  // 属性
  #props = {
    backgroupCanvas: "#000",
    borderColor: "#fff",
    rangeSize: [300, 300],
  };
  // 颜色参数
  #colorPara_base = {
    colormapIndex: "B&W",
    ww: 1000,
    wl: 500,
  };
  #colorPara_fusion = {
    colormapIndex: "PET",
    ww: 10000,
    wl: 5000,
  };
  // 变换参数、厚度、十字定位位置
  #transformPara = {
    scale: { x: 0.5, y: 0.5 },
    translate: { x: 0, y: 0 },
    rotate: 0,
  };
  #thickness = 1;
  #crossPos = {
    x: 10,
    y: 10,
    r: 0,
  };
  #crossOn3DScreen = {
    x: 10,
    y: 10,
    r: 0,
  };
  // 新坐标轴、颜色
  #newaxes = { newX: [1, 0, 0], newY: [0, 1, 0], newZ: [0, 0, 1] };
  #colorS = "#3470d8";
  #colorC = "#cd9700";
  #colorT = "#8a00da";

  // 十字线样式
  #positionLine = {
    // 十字定位线
    default: {
      colorX: "#25a5ad",
      colorY: "#25a5ad",
      dottedLine1: [], // 空数组代表实线, [1, 1]: 虚线长度1，实线长度1，虚线长度1，实线...
      dottedLine2: [],
      thickLine: [7, 5],
    },
    curViewMod0: {
      colorX: this.#colorC,
      colorY: this.#colorS,
      dottedLine1: [],
      dottedLine2: [],
      thickLine: [7, 5],
    },
    curViewMod1: {
      colorX: this.#colorT,
      colorY: this.#colorS,
      dottedLine1: [],
      dottedLine2: [],
      thickLine: [7, 5],
    },
    curViewMod2: {
      colorX: this.#colorT,
      colorY: this.#colorC,
      dottedLine1: [],
      dottedLine2: [],
      thickLine: [7, 5],
    },
    curViewMod3: {
      colorX: this.#colorT,
      colorY: this.#colorC,
      dottedLine1: [],
      dottedLine2: [],
      thickLine: [7, 5],
    },
  };
  // 选择的圆形和矩形
  #circleChoosed = null;
  #rectChoosed = null;

  #imageData = null;

  setProps(para) {
    this.#props = { ...this.#props, ...para };
    let props = this.#props;
    this.#renderCanvas.width = props.rangeSize[0];
    this.#renderCanvas.height = props.rangeSize[1] / 2;
    this.#vtkRootDom.style.width = props.rangeSize[0] + "px";
    this.#vtkRootDom.style.height = props.rangeSize[1] / 2 + "px";
    this.#vtkRootDom.style.top = props.rangeSize[1] / 2 + "px";
  }
  setImageData(imageData) {
    this.#imageData = imageData;
  }
  setCurrenViewMod(curViewMod) {
    this.#curViewMod = curViewMod;
    // 设置捕获器的当前视图模式
    this.#catcherEngine.setCurViewMod(curViewMod);
  }
  // 设置 2D 缩放
  setScale2D(scale) {
    let { pixelSpacingW, pixelSpacingH } = this.#dataWithInfo_base;
    this.#transformPara.scale = {
      x: this.getRenderScale(pixelSpacingW, scale),
      y: this.getRenderScale(pixelSpacingH, scale),
    };
  }
  setScale3D(scale, rotateAngelGlobal) {
    this.setCamera(scale, rotateAngelGlobal);
  }
  setSliceActor(sliceActor) {
    this.#vtkSource = sliceActor;
    this.#vtkRenderer.addActor(sliceActor);
    this.#vtkRenderer.resetCamera();
    this.#vtkRenderWindow.render();
  }

  setCamera(scale, rotateAngelGlobal) {
    let camera = vtk.Rendering.Core.vtkCamera.newInstance();
    let { newX, newY, newZ, newCenter } = this.#newaxes;

    const bounds = this.#imageData.getBounds();
    const size = [
      bounds[1] - bounds[0],
      bounds[3] - bounds[2],
      bounds[5] - bounds[4],
    ];

    const diagonal = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2);
    const distance = diagonal * 1;

    const position = [
      newCenter[0] + newZ[0] * distance,
      newCenter[1] + newZ[1] * distance,
      newCenter[2] + newZ[2] * distance,
    ];

    camera.setParallelProjection(true);
    camera.setParallelScale(scale); // 自动适配视口
    camera.setFocalPoint(...newCenter);
    camera.setPosition(...position);
    camera.setViewUp(...newY);
    this.#vtkRenderer.setActiveCamera(camera);
    this.#vtkRenderer.resetCamera();

    // 将世界坐标转换为归一化显示坐标，更新 #crossOn3DScreen 属性
    let displayCoords = this.#vtkRenderer.worldToNormalizedDisplay(
      newCenter[0],
      newCenter[1],
      newCenter[2],
      1
    );
    const baseAngle = rotateAngelGlobal[this.#curViewMod];
    this.#crossOn3DScreen = {
      x: displayCoords[0] * this.#renderCanvas.width,
      y: (1 - displayCoords[1]) * this.#renderCanvas.height,
      z: displayCoords[2],
      r: rotateAngelGlobal[this.#curViewMod],
      xAngle: baseAngle,
      yAngle: baseAngle,
    };
  }
  // 设置医学图像窗口宽度（WW, Window Width）和窗口中心（WL, Window Level）的函数，
  // 常用于控制CT/MRI 图像的对比度和亮度
  // ww: 窗口宽度（Window Width）——影响图像的对比度
  // wl: 窗口中心（Window Level）——影响图像的亮度
  setWWWL(ww, wl) {
    this.#colorPara_base.ww = ww;
    this.#colorPara_base.wl = wl;
    // "B&W" 表示当前色表为黑白色（Black & White）
    if (this.#vtkSource) this.#vtkSource.setWWWL(ww, wl, "B&W");
  }
  // 设置映射器和演员方法
  setMapperActor(source) {
    const vtkPlane = vtk.Common.DataModel.vtkPlane;
    // 创建两个新的 vtkPlane 实例作为裁剪平面
    this.#clipPlane1 = vtkPlane.newInstance();
    this.#clipPlane2 = vtkPlane.newInstance();
    source.Mapper.addClippingPlane(this.#clipPlane1);
    source.Mapper.addClippingPlane(this.#clipPlane2);
    this.#vtkSource = source;
    // 获取 #vtkSource 的患者体积的像素间距并赋值给 #initPixelSpacing
    this.#initPixelSpacing = this.#vtkSource.patientVolume.getSpacing()[0];
    this.#vtkRenderer.addActor(source.Actor);
    //增加平面
  }
  getActor() {
    return this.#vtkSource.Actor;
  }
  // 设置页面方法（旧版）
  // 根据当前视图模式计算裁剪平面的法线和原点，并设置裁剪平面的属性
  setPage_old(page, thicknessArr, rotateAngelGlobal) {
    let patientVolume = this.#vtkSource.patientVolume;
    let volumeOrigin = patientVolume.getOrigin();
    let volumeSpacing = patientVolume.getSpacing();
    let volumeSize = patientVolume.getDimensions();
    let crossPosOnImage = [page[2], page[1], volumeSize[2] - page[0]];
    let clipPlaneNormal1,
      clipPlaneNormal2,
      clipPlaneOrigin1 = [],
      clipPlaneOrigin2 = [],
      clipPosition1,
      clipPosition2,
      thickness;
    switch (this.#curViewMod) {
      case 0: {
        let page = crossPosOnImage[2];
        thickness = thicknessArr[2];
        clipPosition1 =
          volumeOrigin[2] + page * volumeSpacing[2] - thickness / 2;
        clipPosition2 = -(
          volumeOrigin[2] +
          page * volumeSpacing[2] +
          thickness / 2
        );
        clipPlaneNormal1 = [0, 0, 1];
        clipPlaneNormal2 = [0, 0, -1];
        break;
      }
      case 1: {
        let page = crossPosOnImage[1];
        thickness = thicknessArr[1];
        clipPosition1 =
          volumeOrigin[1] + page * volumeSpacing[1] - thickness / 2;
        clipPosition2 = -(
          volumeOrigin[1] +
          page * volumeSpacing[1] +
          thickness / 2
        );
        clipPlaneNormal1 = [0, 1, 0];
        clipPlaneNormal2 = [0, -1, 0];
        break;
      }
      case 2: {
        let page = crossPosOnImage[0];
        thickness = thicknessArr[0];
        clipPosition1 =
          volumeOrigin[0] + page * volumeSpacing[0] - thickness / 2;
        clipPosition2 = -(
          volumeOrigin[0] +
          page * volumeSpacing[0] +
          thickness / 2
        );
        clipPlaneNormal1 = [1, 0, 0];
        clipPlaneNormal2 = [-1, 0, -0];
        break;
      }
    }

    clipPlaneOrigin1 = [
      clipPlaneNormal1[0] * clipPosition1,
      clipPlaneNormal1[1] * clipPosition1,
      clipPlaneNormal1[2] * clipPosition1,
    ];
    clipPlaneOrigin2 = [
      clipPlaneNormal2[0] * clipPosition2,
      clipPlaneNormal2[1] * clipPosition2,
      clipPlaneNormal2[2] * clipPosition2,
    ];
    this.#clipPlane1.setNormal(clipPlaneNormal1);
    this.#clipPlane1.setOrigin(clipPlaneOrigin1);
    this.#clipPlane2.setNormal(clipPlaneNormal2);
    this.#clipPlane2.setOrigin(clipPlaneOrigin2);
  }
  // 设置十字定位方法
  // 根据患者体积的原点、间距、十字定位位置和旋转角度计算坐标轴和裁剪平面的法线、原点，
  // 并设置裁剪平面的属性
  // crossPosOnImage：图像空间中的十字线位置（如 [s, c, t]）
  // thicknessArr：层厚数组，分别表示 T/C/S 三个方向的厚度
  // rotateAngelGlobal：全局旋转角度数组，对应 T/C/S 三个方向
  setCross(crossPosOnImage, thicknessArr, rotateAngelGlobal) {
    // 获取当前体积数据（volume）对象
    let patientVolume = this.#vtkSource.patientVolume;
    // origin 是体数据的起点坐标（世界坐标系）
    let volumeOrigin = patientVolume.getOrigin();
    // spacing 是每个像素/体素的物理间距
    let volumeSpacing = patientVolume.getSpacing();
    let clipPlaneNormal1,
      clipPlaneNormal2,
      clipPlaneOrigin1 = [],
      clipPlaneOrigin2 = [];
    const center = this.#GPARA.crossSectionState.center;
    const { newX, newY, newZ, newCenter } = getNewAxesFromPlane(
      center,
      this.#plane.normal,
      this.#plane.viewUp
    );

    this.#newaxes = { newX, newY, newZ, newCenter };
    // 根据当前视图模式（T/C/S），获取当前方向上的层厚
    this.#thickness = thicknessArr[this.#curViewMod];
    // clipPlaneNormal1 与 clipPlaneNormal2 是 两个相反方向的法向量，用于两个反向平面的裁剪
    clipPlaneNormal1 = [newZ[0], newZ[1], newZ[2]];
    clipPlaneNormal2 = [-newZ[0], -newZ[1], -newZ[2]];
    // 从 newCenter 出发，沿 Z 方向的正负方向偏移一半的层厚，得到两个平面的位置
    // 这两个平面形成一个 slab（截面厚度区间）
    for (let i = 0; i < 3; i++) {
      clipPlaneOrigin1[i] = newCenter[i] - (this.#thickness / 2) * newZ[i];
      clipPlaneOrigin2[i] = newCenter[i] + (this.#thickness / 2) * newZ[i];
    }
    // 将计算出的 法向量和原点 应用到两个 vtkPlane 对象上
    // 通常这两个平面被用于设置 vtkImageReslice 或 vtkVolumeMapper 的剪裁
    this.#clipPlane1.setNormal(clipPlaneNormal1);
    this.#clipPlane1.setOrigin(clipPlaneOrigin1);
    this.#clipPlane2.setNormal(clipPlaneNormal2);
    this.#clipPlane2.setOrigin(clipPlaneOrigin2);
  }
  getAngleBetween(vecA, vecB) {
    const dot = vecA[0] * vecB[0] + vecA[1] * vecB[1];
    const magA = Math.sqrt(vecA[0] * vecA[0] + vecA[1] * vecA[1]);
    const magB = Math.sqrt(vecB[0] * vecB[0] + vecB[1] * vecB[1]);
    return Math.acos(dot / (magA * magB));
  }

  #crossMoveStart = false;
  #crossThickStart = false;
  #crossRotateStart = false;
  setCrossFromCatcher(pos, flag) {
    if (flag === "start") {
      if (this.#circleChoosed) {
        this.#crossRotateStart = pos;
        this.#crossMoveStart = false;
        this.#crossThickStart = false;
      } else if (this.#rectChoosed) {
        this.#crossThickStart = {
          axes: this.#rectChoosed.axes,
          imatrix: this.#rectChoosed.imatrix,
          axisPoint: this.#rectChoosed.axisPoint,
          start: pos,
          offset: this.#rectChoosed.offset,
        };
        this.#crossMoveStart = false;
        this.#crossRotateStart = false;
      } else {
        this.#crossMoveStart = pos;
        this.#crossRotateStart = false;
        this.#crossThickStart = false;
      }
      //设置鼠标样式为不可见
      this.#catcherEngine.getCatrcherDom().style.cursor = "none";
    }
    if (flag === "end") {
      this.#crossMoveStart = false;
      this.#crossThickStart = false;
      this.#crossRotateStart = false;
      this.drawCrossOn3d(pos);
      //设置鼠标样式为默认
      this.#catcherEngine.getCatrcherDom().style.cursor = "default";
    }
    if (flag === "move") {
      if (this.#crossMoveStart) {
        // 屏幕坐标转归一化坐标（0~1），并Y轴翻转
        let screenPosNormalized = {
          x: pos.x / this.#renderCanvas.width,
          y: 1 - pos.y / this.#renderCanvas.height,
          z: this.#crossOn3DScreen.z,
        };
        // 转换为世界坐标
        let worldPos = this.#vtkRenderer.normalizedDisplayToWorld(
          screenPosNormalized.x,
          screenPosNormalized.y,
          screenPosNormalized.z,
          1
        );
        // 计算在图像体素中的位置（整数索引）
        let origin = this.#vtkSource.patientVolume.getOrigin();
        let pixcelSpacing = this.#vtkSource.patientVolume.getSpacing();
        let newCrossOnImage = [
          Math.round((worldPos[0] - origin[0]) / pixcelSpacing[0]),
          Math.round((worldPos[1] - origin[1]) / pixcelSpacing[1]),
          Math.round((worldPos[2] - origin[2]) / pixcelSpacing[2]),
        ];
        //赋值
        let temp = this.#GPARA;
        temp.pageS = newCrossOnImage[0];
        temp.pageC = newCrossOnImage[1];
        temp.pageT = newCrossOnImage[2];
        temp.crossSectionState.center = worldPos;
        this.#GPARA.value = { ...temp };
      }
      if (this.#crossRotateStart) {
        // 鼠标拖动时调用
        let start = this.#crossRotateStart; // {x, y} 屏幕坐标
        let end = pos; // {x, y} 屏幕坐标

        let screenPosNormalized1 = {
          x: start.x / this.#renderCanvas.width,
          y: 1 - start.y / this.#renderCanvas.height,
          z: this.#crossOn3DScreen.z,
        };
        const worldStart = this.#vtkRenderer.normalizedDisplayToWorld(
          screenPosNormalized1.x,
          screenPosNormalized1.y,
          screenPosNormalized1.z,
          1
        );
        let screenPosNormalized2 = {
          x: end.x / this.#renderCanvas.width,
          y: 1 - end.y / this.#renderCanvas.height,
          z: this.#crossOn3DScreen.z,
        };
        const worldEnd = this.#vtkRenderer.normalizedDisplayToWorld(
          screenPosNormalized2.x,
          screenPosNormalized2.y,
          screenPosNormalized2.z,
          1
        );

        // 2. 取旋转中心
        const worldCenter = this.#GPARA.crossSectionState.center;

        // 3. 计算球面向量
        function normalize(v) {
          let len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
          return len < 1e-12 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
        }
        const vecA = normalize([
          worldStart[0] - worldCenter[0],
          worldStart[1] - worldCenter[1],
          worldStart[2] - worldCenter[2],
        ]);
        const vecB = normalize([
          worldEnd[0] - worldCenter[0],
          worldEnd[1] - worldCenter[1],
          worldEnd[2] - worldCenter[2],
        ]);

        // 4. 旋转轴和角度
        function cross(a, b) {
          return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ];
        }
        const axis = normalize(cross(vecA, vecB));
        let angle = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              vecA[0] * vecB[0] + vecA[1] * vecB[1] + vecA[2] * vecB[2]
            )
          )
        );
        if (isNaN(angle) || Math.abs(angle) < 1e-6) return;

        // 5. 对法线旋转
        function rotateVectorAroundAxis(v, axis, rad) {
          // Rodrigues' rotation formula
          const [x, y, z] = v;
          const [u, v1, w] = axis;
          const cosA = Math.cos(rad);
          const sinA = Math.sin(rad);
          const dot = x * u + y * v1 + z * w;
          const cross = [v1 * z - w * y, w * x - u * z, u * y - v1 * x];
          return [
            u * dot * (1 - cosA) + x * cosA + cross[0] * sinA,
            v1 * dot * (1 - cosA) + y * cosA + cross[1] * sinA,
            w * dot * (1 - cosA) + z * cosA + cross[2] * sinA,
          ];
        }
        const planes = this.#GPARA.crossSectionState.planes;
        const currentPlane = planes.find(
          (p) => p.name === this.#currentRotatePlane
        );
        if (window.isOrthogonalRotation) {
          const orthogonalPlane = planes.find(
            (a) =>
              a.name !== this.#currentUnRotatePlane &&
              a.name !== this.#currentRotatePlane
          );
          // 旋转 currentPlane 的法向量
          const oldNormal = currentPlane.normal;
          const newNormal = rotateVectorAroundAxis(oldNormal, axis, angle);
          currentPlane.normal[0] = newNormal[0];
          currentPlane.normal[1] = newNormal[1];
          currentPlane.normal[2] = newNormal[2];

          // 旋转 orthogonalPlane 的法向量（核心新增）
          if (orthogonalPlane) {
            const oldOrtNormal = orthogonalPlane.normal;
            const newOrtNormal = rotateVectorAroundAxis(
              oldOrtNormal,
              axis,
              angle
            );
            orthogonalPlane.normal[0] = newOrtNormal[0];
            orthogonalPlane.normal[1] = newOrtNormal[1];
            orthogonalPlane.normal[2] = newOrtNormal[2];
          }
        } else {
          const oldNormal = currentPlane.normal;
          const newNormal = rotateVectorAroundAxis(oldNormal, axis, angle);
          currentPlane.normal[0] = newNormal[0];
          currentPlane.normal[1] = newNormal[1];
          currentPlane.normal[2] = newNormal[2];
        }
        if (angle != 0) {
          let temp = this.#GPARA;
          if (this.#curViewMod === 0) {
            temp.rotateT = Number(temp.rotateT) + angle;
          }
          if (this.#curViewMod === 1) {
            temp.rotateC = Number(temp.rotateC) + angle;
          }
          if (this.#curViewMod === 2) {
            temp.rotateS = Number(temp.rotateS) + angle;
          }
          this.#crossRotateStart = { ...end };
          this.#GPARA.value = { ...temp };
        }
      }
      if (this.#crossThickStart) {
        let { imatrix, axes, axisPoint, start, offset } = this.#crossThickStart; // 加入 offset
        const { x1, y1, x2, y2 } = axisPoint;
        let end = this.screenToCanvas(pos, imatrix); //去除旋转的影响

        // 1. 计算基准线的方向向量和法向量
        let dx = x2 - x1,
          dy = y2 - y1;
        let len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-6) return;
        let ux = dx / len,
          uy = dy / len;
        let nx = -uy,
          ny = ux; // 法向量（垂直于基准线）

        // 2. 鼠标拖动向量
        let vx = end.x - start.x;
        let vy = end.y - start.y;

        // 3. 拖动在法向上的投影
        let proj = vx * nx + vy * ny;

        // === 关键：区分有无offset ===
        let newThick;
        if (typeof offset === "number") {
          newThick = Math.abs(offset + proj);
        } else {
          newThick = Math.abs(proj);
        }

        // 4. 单位换算
        newThick =
          (2 * newThick * this.#initPixelSpacing) / Number(this.#GPARA.scale);

        let minThick = 1;
        let temp = this.#GPARA;
        if (this.#curViewMod === 0) {
          if (axes === "x") temp.thickC = newThick;
          if (axes === "y") temp.thickS = newThick;
        }
        if (this.#curViewMod === 1) {
          if (axes === "x") temp.thickT = newThick;
          if (axes === "y") temp.thickS = newThick;
        }
        if (this.#curViewMod === 2) {
          if (axes === "x") temp.thickT = newThick;
          if (axes === "y") temp.thickC = newThick;
        }
        //层厚不能小于最小值
        Number(temp.thickS) < minThick
          ? (temp.thickS = minThick)
          : (temp.thickS = Number(
              (Math.round(temp.thickS * 100) / 100).toFixed(2)
            ));
        Number(temp.thickC) < minThick
          ? (temp.thickC = minThick)
          : (temp.thickC = Number(
              (Math.round(temp.thickC * 100) / 100).toFixed(2)
            ));
        Number(temp.thickT) < minThick
          ? (temp.thickT = minThick)
          : (temp.thickT = Number(
              (Math.round(temp.thickT * 100) / 100).toFixed(2)
            ));
        this.#GPARA.value = { ...temp };
      }
    }
  }

  // 计算向量夹角方法
  // 用于计算两个向量之间的夹角，使用 Math.atan2 函数计算向量的夹角
  getAngle(vecA, vecB) {
    let angle = Math.atan2(vecB[1], vecB[0]) - Math.atan2(vecA[1], vecA[0]);
    return angle;
  }
  // 计算旋转后的向量
  // 使用三角函数计算旋转后的向量
  getNewVec(vec, angle) {
    let newVec = [
      vec[0] * Math.cos(angle) - vec[1] * Math.sin(angle),
      vec[0] * Math.sin(angle) + vec[1] * Math.cos(angle),
    ];
    return newVec;
  }
  // 设置图像重采样方法
  setImageReslice(crossPosOnImage, thicknessArr, rotateArr) {
    // 创建一个 vtkImageReslice 实例，设置输入数据、输出维度、平板模式、输出数据类型、
    // 插值模式和变换输入采样
    let patientVolume = this.#vtkSource.patientVolume;
    let volumeOrigin = patientVolume.getOrigin();
    let volumeSpacing = patientVolume.getSpacing();
    const vtkImageReslice = vtk.Imaging.Core.vtkImageReslice;
    const imageReslice = vtkImageReslice.newInstance();
    this.#thickness = thicknessArr[this.#curViewMod];
    imageReslice.setInputData(patientVolume);

    imageReslice.setOutputDimensionality(2);
    imageReslice.setSlabMode(1); //最大密度投影，最小密度投影，平均密度投影，求和

    imageReslice.setOutputScalarType("Uint16Array"); // 设置输出数据类型
    imageReslice.setInterpolationMode("Nearest"); //设置插值模式,Linear或者Nearest
    imageReslice.setTransformInputSampling(true); //是否使用输入数据默认的spacing, origin and extent作为输出，默认值为true
    //mat formate，以当前图像的坐标轴为基准，进行旋转，所有矩阵的操作，都是以图像坐标系为基准的
    // 1 0 0 0
    // 0 1 0 0
    // 0 0 1 0
    // 0 0 0 1
    // 调用 getAxes 方法计算坐标轴，设置重采样轴和切片数量
    // let axes = this.getAxes(
    //   volumeOrigin,
    //   volumeSpacing,
    //   crossPosOnImage,
    //   rotateArr
    // );
    let axes = this.getNewAxes(
      volumeOrigin,
      volumeSpacing,
      crossPosOnImage,
      this.#plane.normal
    );
    imageReslice.setSlabNumberOfSlices(this.#thickness);
    imageReslice.setResliceAxes(axes);
    let obliqueSlice = imageReslice.getOutputData();
    let dataArray = obliqueSlice.getPointData().getScalars().getData();
    // 调用 getDataWithInfo 方法获取图像数据及相关信息
    let curDWI = this.getDataWithInfo(obliqueSlice, dataArray);
    // 调用 loadBaseData 方法加载基础数据
    this.loadBaseData(curDWI);
    // 调用 getCrossPos 方法计算十字定位位置
    this.#crossPos = this.getCrossPos(rotateArr, curDWI);
    switch (this.#curViewMod) {
    }
  }
  // 加载混合数据方法
  loadMixData(dataWithInfo_base, dataWithInfo_fusion) {
    this.#dataWithInfo_base = dataWithInfo_base;
    this.#dataWithInfo_fusion = dataWithInfo_fusion;
    // 更新混合图像
    this.updateImgFromMix();
  }
  // 加载基础数据
  loadBaseData(dataWithInfo) {
    this.#dataWithInfo_base = dataWithInfo;
    // 设置当前视图模式为 dataWithInfo.curViewMod，
    // 并调用 updateFromBase 方法更新基础图像
    this.#curViewMod = dataWithInfo.curViewMod;
    this.updateFromBase();
  }

  // 更新基础图像
  updateFromBase() {
    if (!this.#dataWithInfo_base) return;
    if (!this.#dataWithInfo_base.origBuf) return;
    // 如果 #dataWithInfo_base.origBuf 是彩图，
    // 则将图像数据绘制到 this.imageData.img 上
    if (this.#dataWithInfo_base.origBuf.isColor) {
      //是彩图
      renderData = origBuf;
      this.imageData.img.width = renderData.width;
      this.imageData.img.height = renderData.height;
      let ctx = this.imageData.img.getContext("2d");
      ctx.putImageData(renderData, 0, 0);
    }
    // 从 #colorPara_base 中获取色表索引、窗口宽度和窗口中心，
    // 设置目标缩放比例为 { x: 1, y: 1 }
    let { colormapIndex, ww, wl } = this.#colorPara_base;
    let tarScale = { x: 1, y: 1 };
    // 调用 CIMG.getRenderCImg 方法获取渲染后的图像，并赋值给 #imgCanvas
    this.#imgCanvas = CIMG.getRenderCImg(
      this.#dataWithInfo_base.origBuf,
      colormapIndex,
      ww,
      wl,
      tarScale,
      this.#imgCanvas
    );
  }

  // 更新混合图像
  updateMixImg() {
    // 检查基础数据是否存在，若不存在则直接返回，不执行后续操作
    if (!this.#dataWithInfo_base) return;
    // 检查基础数据的原始缓冲区是否存在，若不存在则直接返回
    if (!this.#dataWithInfo_base.origBuf) return;
    // 检查融合数据是否存在，若不存在则直接返回
    if (!this.#dataWithInfo_fusion) return;
    // 检查融合数据的原始缓冲区是否存在，若不存在则直接返回
    if (!this.#dataWithInfo_fusion.origBuf) return;

    //计算PT到CT的缩放和转换参数，这些参数用于后续图像融合
    let { scalePTtoCT, transPTtoCT } = LOAD.getFusionPara(
      this.#dataWithInfo_base,
      this.#dataWithInfo_fusion,
      this.#curViewMod
    );

    //暂时不考虑缩放过的情况
    let tarScale = { x: 1, y: 1 };
    //获取renderData
    // 获取基础数据的渲染数据，根据基础颜色参数和目标缩放比例进行渲染
    let {
      colormapIndex: colormapIndex1,
      ww: ww1,
      wl: wl1,
    } = this.#colorPara_base;
    let ct_renderData = CIMG.getRenderData(
      this.#dataWithInfo_base,
      colormapIndex1,
      ww1,
      wl1,
      tarScale
    );
    // 获取融合数据的渲染数据，根据融合颜色参数和目标缩放比例进行渲染
    let {
      colormapIndex: colormapIndex2,
      ww: ww2,
      wl: wl2,
    } = this.#colorPara_fusion;
    let pt_renderData = CIMG.getRenderData(
      this.imageData.dataWithInfo.origBuf,
      colormapIndex2,
      ww2,
      wl2,
      tarScale
    );
    // 融合基础数据和融合数据的渲染结果，得到最终的混合图像
    this.#imgCanvas = CIMG.getMixRenderCImg(
      ct_renderData,
      pt_renderData,
      scalePTtoCT,
      transPTtoCT,
      this.#fusionOpacity,
      this.#imgCanvas,
      this.#hideCanvas1,
      this.#hideCanvas2
    );
  }
  // 该函数用于刷新图像，先清除画布并填充黑色，然后绘制图像（包含变换操作），最后绘制十字定位线
  refreshImg() {
    // 从变换参数对象中解构出缩放、旋转和平移参数
    let { scale, rotate, translate } = this.#transformPara;
    // 清除渲染画布的内容，准备重新绘制
    this.#renderContext.clearRect(
      0,
      0,
      this.#renderCanvas.width,
      this.#renderCanvas.height
    );
    // 设置填充颜色为黑色
    let color = "#000";
    this.#renderContext.fillStyle = color;
    // 使用黑色填充整个渲染画布
    this.#renderContext.fillRect(
      0,
      0,
      this.#renderCanvas.width,
      this.#renderCanvas.height
    );
    // 在画布上绘制图像，并应用缩放、旋转和平移变换
    this.ctxDrawImage(
      this.#renderContext,
      this.#imgCanvas,
      scale,
      rotate,
      translate,
      this.#renderCanvas.width,
      this.#renderCanvas.height
    );
    // 在画布上绘制十字定位线
    this.drawCross(this.#renderContext);
  }
  // 该函数用于在画布上绘制图像，支持调窗后的缩放，
  // 绘制过程包括保存画布状态、缩放、平移、旋转等变换操作，
  // 最后绘制图像并恢复画布状态
  ctxDrawImage(
    canvasEle_ctx,
    image,
    scale,
    rotate,
    translate,
    canvasWidth,
    canvasHeight
  ) {
    // 如果图像不存在，则不执行后续绘制操作，直接返回
    if (!image) return;
    // 复制当前缩放参数，以便后续可能的修改
    let scaleCur = { ...scale },
      imageCur = image;
    // 检查图像是否有调窗后的缩放信息
    let { ifInterPro, interCImg } = image;
    // 如果存在调窗后的缩放信息
    if (ifInterPro && interCImg) {
      // 计算调窗后的缩放比例
      let scale_self = {
        x: interCImg.width / image.width,
        y: interCImg.height / image.height,
      };
      // 根据调窗后的缩放比例调整当前缩放参数
      scaleCur.x = scale.x / scale_self.x;
      scaleCur.y = scale.y / scale_self.y;
      // 更新当前图像为调窗后的图像
      imageCur = interCImg;
    }
    // 保存当前画布状态，以便后续恢复
    canvasEle_ctx.save();
    // 应用缩放变换
    canvasEle_ctx.scale(scaleCur.x, scaleCur.y);
    // 计算平移到图像中心的偏移量
    let tempX =
      (canvasWidth / 2 + translate.x) / scaleCur.x - imageCur.width / 2;
    let tempY =
      (canvasHeight / 2 + translate.y) / scaleCur.y - imageCur.height / 2;
    // 执行平移变换
    canvasEle_ctx.translate(tempX, tempY);
    // 先平移到图像中心，为旋转做准备
    canvasEle_ctx.translate(imageCur.width / 2, imageCur.height / 2);
    // 恢复缩放，使旋转基于原始图像大小
    canvasEle_ctx.scale(1 / scaleCur.x, 1 / scaleCur.y);
    // 执行旋转变换
    canvasEle_ctx.rotate(rotate);
    // 再次应用缩放
    canvasEle_ctx.scale(scaleCur.x, scaleCur.y);
    // 平移回图像左上角
    canvasEle_ctx.translate(-imageCur.width / 2, -imageCur.height / 2);
    // 在画布上绘制图像
    canvasEle_ctx.drawImage(imageCur, 0, 0);
    // 恢复画布到保存时的状态
    canvasEle_ctx.restore();
  }

  //十字定位
  // 该函数用于在画布上绘制十字定位线，先判断十字定位位置是否存在，
  // 然后转换坐标，保存画布状态，进行平移和旋转，绘制十字线，
  // 最后恢复画布状态
  drawCross(ctx) {
    // 如果十字定位位置信息不存在，则不执行绘制操作，直接返回
    if (!this.#crossPos) {
      return;
    }
    // 从变换参数对象中解构出平移、旋转和缩放参数
    let { translate, rotate, scale } = this.#transformPara;
    // 从十字定位位置对象中解构出坐标和旋转角度
    let { x, y, r = 0 } = this.#crossPos;
    // 获取当前图像的宽度和高度
    let width = this.#imgCanvas.width;
    let height = this.#imgCanvas.height;
    // 将图像坐标转换为画布坐标
    let point = LOAD.$coordinateImageToCanvas(
      translate,
      rotate,
      scale,
      width,
      height,
      this.#renderCanvas.width,
      this.#renderCanvas.height,
      { x, y }
    );
    // 保存当前画布状态
    ctx.save();
    // 平移画布到十字定位点
    ctx.translate(point.x, point.y);
    // 旋转画布到十字定位的旋转角度
    ctx.rotate(r);

    let l = 3000;
    // 设置线条宽度为1
    ctx.lineWidth = 1;
    ctx.lineWidth = 1;
    // 获取当前视图模式对应的十字线颜色和样式
    let { colorX, colorY, dottedLine1, dottedLine2 } =
      this.#positionLine["curViewMod" + this.#curViewMod];

    // 设置线条颜色为colorX，设置虚线样式，绘制X轴正向和负向的线段
    ctx.strokeStyle = colorX;
    ctx.setLineDash(dottedLine1);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-l, 0);
    ctx.stroke();

    ctx.moveTo(5, 0);
    ctx.lineTo(l, 0);
    ctx.stroke();

    // 设置线条颜色为colorY，设置虚线样式，绘制Y轴正向和负向的线段
    ctx.strokeStyle = colorY;
    ctx.setLineDash(dottedLine2);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, -l);
    ctx.stroke();

    ctx.moveTo(0, 5);
    ctx.lineTo(0, l);
    ctx.stroke();
    // 恢复画布到保存时的状态
    ctx.restore();
  }
  getOtherPlanes() {
    return GPARA.crossSectionState.planes.filter((n) => n.name !== this.#key);
  }
  drawCrossOn3d(screenPos = {}) {
    let ctx = this.#renderCanvas3D.getContext("2d");
    ctx.clearRect(
      0,
      0,
      this.#renderCanvas3D.width,
      this.#renderCanvas3D.height
    );

    ctx.save();

    let Dis = 60,
      rForCircle = 5,
      rForRect = 4,
      findRange = 10;
    let circleDis = 2 * Dis,
      rectDis = Dis;

    let thicknessX, thicknessY;
    let { thickT, thickC, thickS } = this.#GPARA;
    thickT = Number(thickT);
    thickC = Number(thickC);
    thickS = Number(thickS);

    // 依据视图模式选择厚度方向。注意：转换为屏幕单位后还缩小为一半（即绘制的是±厚度的一半线）
    switch (this.#curViewMod) {
      case 0: {
        thicknessX = thickC;
        thicknessY = thickS;
        break;
      }
      case 1: {
        thicknessX = thickT;
        thicknessY = thickS;
        break;
      }
      case 2: {
        thicknessX = thickT;
        thicknessY = thickC;
        break;
      }
    }
    //转换成屏幕上的层厚
    thicknessX =
      (thicknessX / this.#initPixelSpacing) * Number(this.#GPARA.scale);
    thicknessY =
      (thicknessY / this.#initPixelSpacing) * Number(this.#GPARA.scale);

    thicknessX = thicknessX / 2;
    thicknessY = thicknessY / 2;

    let flag = {
      circleShow: false,
      rectShow: false,
      rectShowX: false,
      rectShowY: false,
    };
    let canvasPos = {};
    const transform = ctx.getTransform();
    const imatrix = transform.invertSelf();

    if (this.#crossRotateStart) {
      flag.circleShow = true;
      flag.rectShow = false;
    }
    if (this.#crossThickStart) {
      flag.rectShow = true;
      flag.circleShow = false;
    }

    const otherPlanes = this.getOtherPlanes();
    const targetNormal = this.#plane.normal;
    let { dottedLine1, dottedLine2, thickLine } =
      this.#positionLine["curViewMod" + this.#curViewMod];
    const line = [];
    const circle = [];
    const rect = [];
    const xAxisProjPlaneName = {
      "transverse-xy": "coronal-xz", // transverse视图时，coronal-xz是x轴投影线
      "coronal-xz": "transverse-xy", // coronal视图时，transverse-xy是x轴投影线
      "sagittal-yz": "transverse-xy", // sagittal视图时，transverse-xy是x轴投影线
    }[this.#plane.name];
    const allProjLines = [];
    const allLinesInfo = [];
    otherPlanes.forEach((otherPlane, i) => {
      // 交线方向
      const dir = [
        targetNormal[1] * otherPlane.normal[2] -
          targetNormal[2] * otherPlane.normal[1],
        targetNormal[2] * otherPlane.normal[0] -
          targetNormal[0] * otherPlane.normal[2],
        targetNormal[0] * otherPlane.normal[1] -
          targetNormal[1] * otherPlane.normal[0],
      ];

      const magnitude = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
      if (magnitude < 1e-6) {
        return;
      }

      const unitDir = dir.map((d) => d / magnitude);

      let { newCenter } = this.#newaxes;

      const clipped = getLineWithoutBounds(newCenter, unitDir, 300);

      const [worldP1, worldP2] = clipped;

      const widthC = this.#renderCanvas.width;
      const heightC = this.#renderCanvas.height;

      const displayCoords1 = this.#vtkRenderer.worldToNormalizedDisplay(
        worldP1[0],
        worldP1[1],
        worldP1[2],
        1
      );

      const displayCoords2 = this.#vtkRenderer.worldToNormalizedDisplay(
        worldP2[0],
        worldP2[1],
        worldP2[2],
        1
      );

      let x1 = displayCoords1[0] * widthC;
      let y1 = (1 - displayCoords1[1]) * heightC;

      let x2 = displayCoords2[0] * widthC;
      let y2 = (1 - displayCoords2[1]) * heightC;
      allProjLines.push({ x1, y1, x2, y2, plane: otherPlane.name });

      const CD = 5;
      const [seg1, seg2] = splitLineAtCenterGap(x1, y1, x2, y2, CD);

      line.push({
        strokeStyle: lineColors[otherPlane.name],
        c: seg1,
        dottSytle: i === 0 ? dottedLine1 : dottedLine2,
        plane: otherPlane.name,
      });

      line.push({
        strokeStyle: lineColors[otherPlane.name],
        c: seg2,
        dottSytle: i === 0 ? dottedLine1 : dottedLine2,
        plane: otherPlane.name,
      });

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / length;
      const uy = dy / length;

      allLinesInfo.push({
        midX,
        midY,
        ux,
        uy,
        plane: otherPlane.name,
        lineColor: lineColors[otherPlane.name],
        x1,
        y1,
        x2,
        y2,
        axes: otherPlane.name == xAxisProjPlaneName ? "x" : "y",
      });
    });
    if (screenPos.x && screenPos.y) {
      canvasPos = this.screenToCanvas(screenPos, imatrix);
      let { x, y } = canvasPos;
      if (x && y) {
        for (let proj of allProjLines) {
          const d1 = getDistanceToSegment(
            x,
            y,
            proj.x1,
            proj.y1,
            proj.x2,
            proj.y2
          );
          if (d1 < findRange) {
            flag.circleShow = true;
            flag.rectShow = true;
            break; // 已经满足条件，直接退出
          }
          // 如果有thicknessX/thicknessY平移的线也要判断，可以在这里加判断
          // 例如（如果你有 thicknessX/thicknessY 的加粗线）：
          // 计算法向量
          const dx = proj.x2 - proj.x1;
          const dy = proj.y2 - proj.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1e-6) continue;
          const nx = -dy / len,
            ny = dx / len;
          // 判断偏移后的两条线
          if (
            thicknessX > 1 &&
            (getDistanceToSegment(
              x,
              y,
              proj.x1 + nx * thicknessX,
              proj.y1 + ny * thicknessX,
              proj.x2 + nx * thicknessX,
              proj.y2 + ny * thicknessX
            ) < findRange ||
              getDistanceToSegment(
                x,
                y,
                proj.x1 - nx * thicknessX,
                proj.y1 - ny * thicknessX,
                proj.x2 - nx * thicknessX,
                proj.y2 - ny * thicknessX
              ) < findRange)
          ) {
            flag.circleShow = true;
            flag.rectShow = true;
            break;
          }
          if (
            thicknessY > 1 &&
            (getDistanceToSegment(
              x,
              y,
              proj.x1 + nx * thicknessY,
              proj.y1 + ny * thicknessY,
              proj.x2 + nx * thicknessY,
              proj.y2 + ny * thicknessY
            ) < findRange ||
              getDistanceToSegment(
                x,
                y,
                proj.x1 - nx * thicknessY,
                proj.y1 - ny * thicknessY,
                proj.x2 - nx * thicknessY,
                proj.y2 - ny * thicknessY
              ) < findRange)
          ) {
            flag.circleShow = true;
            flag.rectShow = true;
            break;
          }
        }
      }
    }

    // 循环外统一绘制 circle 和 rect
    if (flag.circleShow) {
      for (const info of allLinesInfo) {
        // 计算两个圆的位置
        const circlePos1 = {
          x: info.midX + info.ux * circleDis,
          y: info.midY + info.uy * circleDis,
        };
        const circlePos2 = {
          x: info.midX - info.ux * circleDis,
          y: info.midY - info.uy * circleDis,
        };
        // 添加两个圆
        circle.push({
          c: { x: circlePos1.x, y: circlePos1.y, r: rForCircle },
          ifFill: false,
          plane: info.plane,
          strokeStyle: info.lineColor,
          fillStyle: info.lineColor,
        });
        circle.push({
          c: { x: circlePos2.x, y: circlePos2.y, r: rForCircle },
          ifFill: false,
          plane: info.plane,
          strokeStyle: info.lineColor,
          fillStyle: info.lineColor,
        });
      }
    }
    // x、y轴厚度虚线的绘制
    if (thicknessX > 1) {
      line
        .filter((l) => l.plane === xAxisProjPlaneName)
        .forEach((base) => {
          const { x1, y1, x2, y2 } = base.c;
          const dx = x2 - x1,
            dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1e-6) return;
          const nx = -dy / len,
            ny = dx / len; // 顺时针法向

          // “上侧”
          let ele1 = JSON.parse(JSON.stringify(base));
          ele1.dottSytle = thickLine;
          ele1.c.x1 = x1 + nx * thicknessX;
          ele1.c.y1 = y1 + ny * thicknessX;
          ele1.c.x2 = x2 + nx * thicknessX;
          ele1.c.y2 = y2 + ny * thicknessX;
          line.push(ele1);

          // “下侧”
          let ele2 = JSON.parse(JSON.stringify(base));
          ele2.dottSytle = thickLine;
          ele2.c.x1 = x1 - nx * thicknessX;
          ele2.c.y1 = y1 - ny * thicknessX;
          ele2.c.x2 = x2 - nx * thicknessX;
          ele2.c.y2 = y2 - ny * thicknessX;
          line.push(ele2);
        });
    }
    if (thicknessY > 1) {
      line
        .filter((l) => {
          const info = allLinesInfo.find((a) => a.plane === l.plane);
          return info && info.axes === "y";
        })
        .forEach((base) => {
          const { x1, y1, x2, y2 } = base.c;
          const dx = x2 - x1,
            dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1e-6) return;
          const nx = -dy / len,
            ny = dx / len; // 顺时针法向

          // “左侧”
          let ele1 = JSON.parse(JSON.stringify(base));
          ele1.dottSytle = thickLine;
          ele1.c.x1 = x1 + nx * thicknessY;
          ele1.c.y1 = y1 + ny * thicknessY;
          ele1.c.x2 = x2 + nx * thicknessY;
          ele1.c.y2 = y2 + ny * thicknessY;
          line.push(ele1);

          // “右侧”
          let ele2 = JSON.parse(JSON.stringify(base));
          ele2.dottSytle = thickLine;
          ele2.c.x1 = x1 - nx * thicknessY;
          ele2.c.y1 = y1 - ny * thicknessY;
          ele2.c.x2 = x2 - nx * thicknessY;
          ele2.c.y2 = y2 - ny * thicknessY;
          line.push(ele2);
        });
    }

    ctx.lineWidth = 2;

    for (let i = 0; i < line.length; i++) {
      this.drawLine(ctx, line[i].c, line[i].dottSytle, line[i].strokeStyle);
    }

    this.#circleChoosed = null;
    if (circle.length) {
      for (let i = 0; i < circle.length; i++) {
        let { x, y } = canvasPos;
        // 判断鼠标是否在圆附近：用欧几里得距离判断是否在可点击范围
        // 点 (x, y) 到圆心 (x_0, y_0) 的距离的平方小于或等于半径的平方
        if (
          x &&
          y &&
          Math.pow(circle[i].c.x - x, 2) + Math.pow(circle[i].c.y - y, 2) <=
            Math.pow(findRange, 2)
        ) {
          circle[i].ifFill = true;
          this.#circleChoosed = this.canvseToScreen(circle[i].c, imatrix);

          if (window.isOrthogonalRotation) {
            this.#currentRotatePlane = circle[i].plane;
            this.#currentUnRotatePlane = this.#plane.name;
          } else {
            this.#currentRotatePlane = circle[i].plane;
          }
          this.#currentRotatePlane = circle[i].plane;
        }
        if (this.#crossRotateStart) {
          circle[i].ifFill = true;
        }
        this.drawCircle(
          ctx,
          circle[i].c,
          circle[i].ifFill,
          circle[i].strokeStyle,
          circle[i].fillStyle
        );
      }
    }

    this.#rectChoosed = null;
    // 只在两条新虚线两端显示rect，中心线不显示rect
    if (flag.rectShow) {
      // x轴厚度虚线两端rect
      if (thicknessX > 1) {
        // 找到x轴投影线
        const xLineInfo = allLinesInfo.find((info) => info.axes === "x");
        if (xLineInfo) {
          const { ux, uy, midX, midY, plane, lineColor, axes } = xLineInfo;
          const nx = -uy,
            ny = ux; // 法向量
          // “两侧”中心点
          const center1 = {
            x: midX + nx * thicknessX,
            y: midY + ny * thicknessX,
          };
          const center2 = {
            x: midX - nx * thicknessX,
            y: midY - ny * thicknessX,
          };
          // 每个中心点两端生成rect
          [
            {
              cx: center1.x + ux * rectDis,
              cy: center1.y + uy * rectDis,
              offset: +thicknessX,
            }, // 上侧
            {
              cx: center1.x - ux * rectDis,
              cy: center1.y - uy * rectDis,
              offset: +thicknessX,
            },
            {
              cx: center2.x + ux * rectDis,
              cy: center2.y + uy * rectDis,
              offset: -thicknessX,
            }, // 下侧
            {
              cx: center2.x - ux * rectDis,
              cy: center2.y - uy * rectDis,
              offset: -thicknessX,
            },
          ].forEach(({ cx, cy, offset }) => {
            rect.push({
              c: { x: cx, y: cy, r: rForRect },
              ifFill: false,
              plane,
              strokeStyle: lineColor,
              fillStyle: lineColor,
              axisPoint: {
                x1: center1.x,
                y1: center1.y,
                x2: center2.x,
                y2: center2.y,
              },
              axes,
              offset,
            });
          });
        }
      }
      // y轴厚度虚线两端rect
      if (thicknessY > 1) {
        // 找到y轴投影线
        const yLineInfo = allLinesInfo.find((info) => info.axes === "y");
        if (yLineInfo) {
          const { ux, uy, midX, midY, plane, lineColor, axes } = yLineInfo;
          const nx = -uy,
            ny = ux; // 法向量
          // “两侧”新线中心点
          const center1 = {
            x: midX + nx * thicknessY,
            y: midY + ny * thicknessY,
          };
          const center2 = {
            x: midX - nx * thicknessY,
            y: midY - ny * thicknessY,
          };

          [
            { base: center1, sign: +1 },
            { base: center1, sign: -1 },
            { base: center2, sign: +1 },
            { base: center2, sign: -1 },
          ].forEach(({ base, sign }) => {
            let offset = base === center1 ? +thicknessY : -thicknessY;
            rect.push({
              c: {
                x: base.x + ux * rectDis * sign,
                y: base.y + uy * rectDis * sign,
                r: rForRect,
              },
              ifFill: false,
              plane,
              strokeStyle: lineColor,
              fillStyle: lineColor,
              axisPoint: {
                x1: base.x + ux * rectDis * sign,
                y1: base.y + uy * rectDis * sign,
                x2: base.x - ux * rectDis * sign,
                y2: base.y - uy * rectDis * sign,
              },
              axes,
              offset,
            });
          });
        }
      }
      // 如果x或y轴厚度不大于1，中心线两端画rect
      if (!(thicknessX > 1) || !(thicknessY > 1)) {
        for (const info of allLinesInfo) {
          const { ux, uy, midX, midY, plane, lineColor, x1, y1, x2, y2, axes } =
            info;
          // 判断只为未加粗方向画rect
          if (
            (axes === "x" && !(thicknessX > 1)) ||
            (axes === "y" && !(thicknessY > 1))
          ) {
            rect.push({
              c: {
                x: midX + ux * rectDis,
                y: midY + uy * rectDis,
                r: rForRect,
              },
              ifFill: false,
              plane,
              strokeStyle: lineColor,
              fillStyle: lineColor,
              axisPoint: { x1, y1, x2, y2 },
              axes,
            });
            rect.push({
              c: {
                x: midX - ux * rectDis,
                y: midY - uy * rectDis,
                r: rForRect,
              },
              ifFill: false,
              plane,
              strokeStyle: lineColor,
              fillStyle: lineColor,
              axisPoint: { x1, y1, x2, y2 },
              axes,
            });
          }
        }
      }
    }

    // rect绘制与选中
    if (rect.length) {
      for (let i = 0; i < rect.length; i++) {
        let { x, y } = canvasPos;
        // 判断鼠标是否在rect附近
        if (
          x &&
          y &&
          Math.abs(rect[i].c.x - x) <= findRange &&
          Math.abs(rect[i].c.y - y) <= findRange
        ) {
          rect[i].ifFill = true;
          this.#rectChoosed = this.canvseToScreen(rect[i].c, imatrix);
          // 直接用axes属性，无需用下标判断
          this.#rectChoosed.axes = rect[i].axes;
          this.#rectChoosed.imatrix = imatrix;
          this.#rectChoosed.axisPoint = rect[i].axisPoint;
          this.#rectChoosed.offset = rect[i].offset;
        }
        // 如果正在加粗，全部填充
        if (this.#crossThickStart) {
          rect[i].ifFill = true;
        }
        this.drawRect(
          ctx,
          rect[i].c,
          rect[i].ifFill,
          rect[i].strokeStyle,
          rect[i].fillStyle
        );
      }
    }
    ctx.restore();
  }

  drawOldCrossOn3d(screenPos = {}) {
    let ctx = this.#renderCanvas3D.getContext("2d");
    ctx.clearRect(
      0,
      0,
      this.#renderCanvas3D.width,
      this.#renderCanvas3D.height
    );
    ctx.save();
    //此处变换到了十字中心点所在的位置
    ctx.translate(this.#crossOn3DScreen.x, this.#crossOn3DScreen.y);
    ctx.rotate(this.#crossOn3DScreen.r);

    let Dis = 60,
      rForCircle = 5,
      rForRect = 4,
      findRange = 10;
    let circleDis = 2 * Dis,
      rectDis = Dis;

    let thicknessX, thicknessY;
    let { thickT, thickC, thickS } = this.#GPARA;
    thickT = Number(thickT);
    thickC = Number(thickC);
    thickS = Number(thickS);

    // 依据视图模式选择厚度方向。注意：转换为屏幕单位后还缩小为一半（即绘制的是±厚度的一半线）
    switch (this.#curViewMod) {
      case 0: {
        thicknessX = thickC;
        thicknessY = thickS;
        break;
      }
      case 1: {
        thicknessX = thickT;
        thicknessY = thickS;
        break;
      }
      case 2: {
        thicknessX = thickT;
        thicknessY = thickC;
        break;
      }
    }
    //转换成屏幕上的层厚
    thicknessX =
      (thicknessX / this.#initPixelSpacing) * Number(this.#GPARA.scale);
    thicknessY =
      (thicknessY / this.#initPixelSpacing) * Number(this.#GPARA.scale);

    thicknessX = thicknessX / 2;
    thicknessY = thicknessY / 2;

    let flag = {
      circleShow: false,
      rectShow: false,
      rectShowX: false,
      rectShowY: false,
    };
    let canvasPos = {};
    const transform = ctx.getTransform();
    const imatrix = transform.invertSelf();
    if (screenPos.x && screenPos.y) {
      canvasPos = this.screenToCanvas(screenPos, imatrix);
      let { x, y } = canvasPos;
      if (x && y) {
        // 判断鼠标靠近中心、厚度边缘位置，是否需要高亮 circle 或 rect
        // circle 显示四角交互按钮，交互状态下可填充

        // rect 显示厚度的可拖拽点，画小矩形判断鼠标是否选中
        if (Math.abs(x) < findRange || Math.abs(y) < findRange) {
          flag.circleShow = true;
          flag.rectShow = true;
        }
        if (
          thicknessX > 1 &&
          (Math.abs(y - thicknessX) < findRange ||
            Math.abs(y + thicknessX) < findRange)
        ) {
          flag.circleShow = true;
          flag.rectShow = true;
        }
        if (
          thicknessY > 1 &&
          (Math.abs(x - thicknessY) < findRange ||
            Math.abs(x + thicknessY) < findRange)
        ) {
          flag.circleShow = true;
          flag.rectShow = true;
        }
      }
    }

    if (this.#crossRotateStart) {
      flag.circleShow = true;
      flag.rectShow = false;
    }
    if (this.#crossThickStart) {
      flag.rectShow = true;
      flag.circleShow = false;
    }

    let l = 3000,
      CD = 5;

    ctx.lineWidth = 2;
    let { colorX, colorY, dottedLine1, dottedLine2, thickLine } =
      this.#positionLine["curViewMod" + this.#curViewMod];

    let line = [
      {
        strokeStyle: colorX,
        c: { x1: -l, y1: 0, x2: -CD, y2: 0 },
        dottSytle: dottedLine1,
      },
      {
        strokeStyle: colorX,
        c: { x1: CD, y1: 0, x2: l, y2: 0 },
        dottSytle: dottedLine1,
      },
      {
        strokeStyle: colorY,
        c: { x1: 0, y1: -l, x2: 0, y2: -CD },
        dottSytle: dottedLine2,
      },
      {
        strokeStyle: colorY,
        c: { x1: 0, y1: CD, x2: 0, y2: l },
        dottSytle: dottedLine2,
      },
    ];
    if (thicknessX > 1) {
      for (let i = 0; i < 2; i++) {
        let ele1 = JSON.parse(JSON.stringify(line[i]));
        ele1.dottSytle = thickLine;
        ele1.c.y1 = -thicknessX;
        ele1.c.y2 = -thicknessX;
        line.push(ele1);
        let ele2 = JSON.parse(JSON.stringify(ele1));
        ele2.c.y1 = thicknessX;
        ele2.c.y2 = thicknessX;
        line.push(ele2);
      }
    }
    // 如果 Y 轴需要加粗（粗于 1 像素）
    // 遍历的是 line[2] 和 line[3]，即 Y 轴的主线段
    if (thicknessY > 1) {
      for (let i = 2; i < 4; i++) {
        let ele1 = JSON.parse(JSON.stringify(line[i]));
        ele1.dottSytle = thickLine;
        ele1.c.x1 = -thicknessY;
        ele1.c.x2 = -thicknessY;
        line.push(ele1);
        let ele2 = JSON.parse(JSON.stringify(ele1));
        ele2.c.x1 = thicknessY;
        ele2.c.x2 = thicknessY;
        line.push(ele2);
      }
    }
    for (let i = 0; i < line.length; i++) {
      this.drawLine(ctx, line[i].c, line[i].dottSytle, line[i].strokeStyle);
    }

    let circle = [];
    if (flag.circleShow) {
      circle[0] = {
        c: { x: -circleDis, y: 0, r: rForCircle },
        ifFill: false,
        strokeStyle: colorX,
        fillStyle: colorX,
      };
      circle[1] = {
        c: { x: circleDis, y: 0, r: rForCircle },
        ifFill: false,
        strokeStyle: colorX,
        fillStyle: colorX,
      };
      circle[2] = {
        c: { x: 0, y: -circleDis, r: rForCircle },
        ifFill: false,
        strokeStyle: colorY,
        fillStyle: colorY,
      };
      circle[3] = {
        c: { x: 0, y: circleDis, r: rForCircle },
        ifFill: false,
        strokeStyle: colorY,
        fillStyle: colorY,
      };
    }
    this.#circleChoosed = null;
    for (let i = 0; i < circle.length; i++) {
      let { x, y } = canvasPos;
      // 判断鼠标是否在圆附近：用欧几里得距离判断是否在可点击范围
      // 点 (x, y) 到圆心 (x_0, y_0) 的距离的平方小于或等于半径的平方
      if (
        x &&
        y &&
        Math.pow(circle[i].c.x - x, 2) + Math.pow(circle[i].c.y - y, 2) <=
          Math.pow(findRange, 2)
      ) {
        circle[i].ifFill = true;
        this.#circleChoosed = this.canvseToScreen(circle[i].c, imatrix);
      }
      if (this.#crossRotateStart) {
        circle[i].ifFill = true;
      }
      this.drawCircle(
        ctx,
        circle[i].c,
        circle[i].ifFill,
        circle[i].strokeStyle,
        circle[i].fillStyle
      );
    }

    let rect = [];
    this.#rectChoosed = null;
    let indexFromXtoY;
    if (flag.rectShow) {
      // 根据 thicknessX 是否大于 1 决定是否绘制上下方共 4 个方块，否则仅绘制中轴线 2 个
      if (thicknessX > 1) {
        rect[0] = {
          c: { x: -rectDis, y: -thicknessX, r: rForRect },
          ifFill: false,
          strokeStyle: colorX,
          fillStyle: colorX,
        };
        rect[1] = {
          c: { x: rectDis, y: -thicknessX, r: rForRect },
          ifFill: false,
          strokeStyle: colorX,
          fillStyle: colorX,
        };
        rect[2] = {
          c: { x: -rectDis, y: thicknessX, r: rForRect },
          ifFill: false,
          strokeStyle: colorX,
          fillStyle: colorX,
        };
        rect[3] = {
          c: { x: rectDis, y: thicknessX, r: rForRect },
          ifFill: false,
          strokeStyle: colorX,
          fillStyle: colorX,
        };
      } else {
        rect[0] = {
          c: { x: -rectDis, y: 0, r: rForRect },
          ifFill: false,
          strokeStyle: colorX,
          fillStyle: colorX,
        };
        rect[1] = {
          c: { x: rectDis, y: 0, r: rForRect },
          ifFill: false,
          strokeStyle: colorX,
          fillStyle: colorX,
        };
      }
      indexFromXtoY = rect.length;

      if (thicknessY > 1) {
        rect[indexFromXtoY] = {
          c: { x: -thicknessY, y: -rectDis, r: rForRect },
          ifFill: false,
          strokeStyle: colorY,
          fillStyle: colorY,
        };
        rect[indexFromXtoY + 1] = {
          c: { x: -thicknessY, y: rectDis, r: rForRect },
          ifFill: false,
          strokeStyle: colorY,
          fillStyle: colorY,
        };
        rect[indexFromXtoY + 2] = {
          c: { x: thicknessY, y: -rectDis, r: rForRect },
          ifFill: false,
          strokeStyle: colorY,
          fillStyle: colorY,
        };
        rect[indexFromXtoY + 3] = {
          c: { x: thicknessY, y: rectDis, r: rForRect },
          ifFill: false,
          strokeStyle: colorY,
          fillStyle: colorY,
        };
      } else {
        rect[indexFromXtoY] = {
          c: { x: 0, y: -rectDis, r: rForRect },
          ifFill: false,
          strokeStyle: colorY,
          fillStyle: colorY,
        };
        rect[indexFromXtoY + 1] = {
          c: { x: 0, y: rectDis, r: rForRect },
          ifFill: false,
          strokeStyle: colorY,
          fillStyle: colorY,
        };
      }
    }
    for (let i = 0; i < rect.length; i++) {
      let { x, y } = canvasPos;
      if (
        x &&
        y &&
        Math.abs(rect[i].c.x - x) <= findRange &&
        Math.abs(rect[i].c.y - y) <= findRange
      ) {
        rect[i].ifFill = true;
        this.#rectChoosed = this.canvseToScreen(rect[i].c, imatrix);
        this.#rectChoosed.type = rect[i].type;
        if (i < indexFromXtoY) {
          this.#rectChoosed.axes = "x";
        } else {
          this.#rectChoosed.axes = "y";
        }
        this.#rectChoosed.imatrix = imatrix;
      }
      if (this.#crossThickStart) {
        rect[i].ifFill = true;
      }
      this.drawRect(
        ctx,
        rect[i].c,
        rect[i].ifFill,
        rect[i].strokeStyle,
        rect[i].fillStyle
      );
    }

    //先画X轴

    ctx.restore();
    this.drawNewCrossOn3d(screenPos);
  }

  drawLine(ctx, c, dottSytle, strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.setLineDash(dottSytle);
    ctx.beginPath();
    ctx.moveTo(c.x1, c.y1);
    ctx.lineTo(c.x2, c.y2);
    ctx.stroke();
    // ctx.closePath();
  }

  drawCircle(ctx, c, ifFill, strokeStyle, fillStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, 2 * Math.PI);
    ctx.stroke();
    if (ifFill) {
      ctx.fill();
    }
    ctx.closePath();
  }
  drawRect(ctx, c, ifFill, strokeStyle, fillStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.rect(c.x - c.r, c.y - c.r, 2 * c.r, 2 * c.r);
    ctx.stroke();
    if (ifFill) {
      ctx.fill();
    }
    ctx.closePath();
  }

  render2d() {
    this.refreshImg();
  }
  render3d() {
    this.#vtkRenderWindow.render();
    this.drawCrossOn3d();
  }
  getNewAxes(volumeOrigin, volumeSpacing, crossPosOnImage, normal) {
    const moveToCross = [
      volumeOrigin[0] + crossPosOnImage[0] * volumeSpacing[0],
      volumeOrigin[1] + crossPosOnImage[1] * volumeSpacing[1],
      volumeOrigin[2] + crossPosOnImage[2] * volumeSpacing[2],
    ];

    const zAxis = vec3.normalize([], normal);

    // 构造一个与 zAxis 不平行的 up 方向（避免与 z 同方向）
    const tempUp = Math.abs(zAxis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];

    const xAxis = vec3.normalize([], vec3.cross([], tempUp, zAxis)); // x = up × z
    const yAxis = vec3.normalize([], vec3.cross([], zAxis, xAxis)); // y = z × x

    // 填入 mat4，前三列是三个坐标轴，最后一列是位移
    const axes = mat4.fromValues(
      xAxis[0],
      yAxis[0],
      zAxis[0],
      0,
      xAxis[1],
      yAxis[1],
      zAxis[1],
      0,
      xAxis[2],
      yAxis[2],
      zAxis[2],
      0,
      moveToCross[0],
      moveToCross[1],
      moveToCross[2],
      1
    );

    return axes;
  }
  getAxes(volumeOrigin, volumeSpacing, crossPosOnImage, rotateAngelGlobal) {
    // 创建一个 4x4 的单位矩阵，用于存储变换后的坐标轴信息
    // Float64Array(16) 表示创建一个长度为 16 的 64 位浮点数数组，这里存储矩阵元素
    const axes = mat4.identity(new Float64Array(16));

    // 计算将坐标系原点平移到当前定位所需点的偏移量
    // 这里结合了体数据的原点位置、十字线在图像上的位置以及体数据的间距
    let moveToCross = [
      volumeOrigin[0] + crossPosOnImage[0] * volumeSpacing[0],
      volumeOrigin[1] + crossPosOnImage[1] * volumeSpacing[1],
      volumeOrigin[2] + crossPosOnImage[2] * volumeSpacing[2],
    ];
    // 使用 mat4.translate 函数将单位矩阵 axes 沿着 moveToCross 向量进行平移
    mat4.translate(axes, axes, moveToCross);

    // 根据当前视图模式进行不同的旋转操作，以获取相应的切片
    switch (this.#curViewMod) {
      case 0: {
        // x - y 平面
        // 绕 Y 轴负方向旋转 rotateAngelGlobal[1] 角度
        mat4.rotateY(axes, axes, -rotateAngelGlobal[1]);
        // 绕 X 轴正方向旋转 rotateAngelGlobal[2] 角度
        mat4.rotateX(axes, axes, rotateAngelGlobal[2]);
        break;
      }
      case 1: {
        // x - z 平面
        // 绕 Z 轴正方向旋转 rotateAngelGlobal[0] 角度
        mat4.rotateZ(axes, axes, rotateAngelGlobal[0]);
        // 绕 X 轴正方向旋转 rotateAngelGlobal[2] 角度
        mat4.rotateX(axes, axes, rotateAngelGlobal[2]);
        // 绕 X 轴正方向旋转 π/2 弧度，以获得当前的截面
        mat4.rotateX(axes, axes, Math.PI / 2);
        break;
      }
      case 2: {
        // y - z 平面
        // 绕 Y 轴负方向旋转 rotateAngelGlobal[1] 角度
        mat4.rotateY(axes, axes, -rotateAngelGlobal[1]);
        // 绕 Z 轴正方向旋转 rotateAngelGlobal[0] 角度
        mat4.rotateZ(axes, axes, rotateAngelGlobal[0]);
        // 绕 Y 轴正方向旋转 π/2 弧度
        mat4.rotateY(axes, axes, Math.PI / 2);
        // 绕 Z 轴正方向旋转 π/2 弧度，以获得当前的截面
        mat4.rotateZ(axes, axes, Math.PI / 2);
        break;
      }
    }
    // 返回经过平移和旋转变换后的坐标轴矩阵
    return axes;
  }

  getCrossPos(rotateAngelGlobal, curDWI) {
    // 十字线在当前坐标系下的位置始终为 [0, 0, 0]
    let crossPosOnWorld = [0, 0, 0];
    // 用于存储十字线在屏幕上的位置和旋转角度
    let crossPos = {};
    // 根据当前视图模式计算十字线在屏幕上的位置和旋转角度
    switch (this.#curViewMod) {
      case 0: {
        // x - y 平面
        // 计算十字线在 x 方向的位置，四舍五入取整
        crossPos.x = Math.round(
          (crossPosOnWorld[0] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW
        );
        // 计算十字线在 y 方向的位置，四舍五入取整
        crossPos.y = Math.round(
          (crossPosOnWorld[1] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH
        );
        // 十字线的旋转角度为 rotateAngelGlobal[0]
        crossPos.r = rotateAngelGlobal[0];
        break;
      }
      case 1: {
        // x - z 平面
        // 计算十字线在 x 方向的位置，四舍五入取整
        crossPos.x = Math.round(
          (crossPosOnWorld[0] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW
        );
        // 计算十字线在 y 方向的位置（这里实际对应 z 方向），四舍五入取整
        crossPos.y = Math.round(
          (crossPosOnWorld[2] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH
        );
        // 十字线的旋转角度为 rotateAngelGlobal[1]
        crossPos.r = rotateAngelGlobal[1];
        break;
      }
      case 2: {
        // y - z 平面
        // 计算十字线在 x 方向的位置（这里实际对应 y 方向），四舍五入取整
        crossPos.x = Math.round(
          (crossPosOnWorld[1] - curDWI.leftTopPos.wA) / curDWI.pixelSpacingW
        );
        // 计算十字线在 y 方向的位置（这里实际对应 z 方向），四舍五入取整
        crossPos.y = Math.round(
          (crossPosOnWorld[2] - curDWI.leftTopPos.hA) / curDWI.pixelSpacingH
        );
        // 十字线的旋转角度为 rotateAngelGlobal[2]
        crossPos.r = rotateAngelGlobal[2];
        break;
      }
    }
    // 返回十字线在屏幕上的位置和旋转角度
    return crossPos;
  }

  getDataWithInfo(slice, dataArray) {
    // 用于存储渲染所需的参数
    let parat = {
      // 切片在宽度方向的像素间距
      pixelSpacingW: slice.getSpacing()[0],
      // 切片在高度方向的像素间距
      pixelSpacingH: slice.getSpacing()[1],
      // 切片在深度方向的像素间距
      pixelSpacingD: slice.getSpacing()[2],
      leftTopPos: {
        // 切片左上角在宽度方向的坐标
        wA: slice.getOrigin()[0],
        // 切片左上角在高度方向的坐标
        hA: slice.getOrigin()[1],
        // 切片左上角在深度方向的坐标
        dA: slice.getOrigin()[2],
      },
      origBuf: {
        // 切片的宽度
        width: slice.getDimensions()[0],
        // 切片的高度
        height: slice.getDimensions()[1],
        // 切片的数据数组
        data: dataArray,
      },
      // 当前视图模式
      curViewMod: this.#curViewMod,
    };
    // 使用 parat 参数创建一个 DataWithInfo 对象
    let curDWI = new DataWithInfo(parat);
    // 返回包含渲染信息的 DataWithInfo 对象
    return curDWI;
  }
  getRenderScale(pixelSpacing, scale) {
    // 根据像素间距和初始像素间距以及传入的缩放比例计算新的缩放比例
    let newScale = (pixelSpacing / this.#initPixelSpacing) * scale;
    // 返回新的缩放比例
    return newScale;
  }
  getContext() {
    // 获取渲染画布的 2D 上下文
    return this.#renderCanvas.getContext("2d");
  }
  getCatcher() {
    // 返回捕获引擎对象
    return this.#catcherEngine;
  }

  canvseToScreen(canvasPos, imatrix) {
    // 解构出画布坐标的 x 和 y 值
    let { x, y } = canvasPos;
    // 解构出逆变换矩阵的各个元素
    const { a, b, c, d, e, f } = imatrix;

    // 根据逆变换矩阵计算屏幕坐标的 x 值
    const screenX = (c * y - d * x + d * e - c * f) / (b * c - a * d);
    // 根据逆变换矩阵计算屏幕坐标的 y 值
    const screenY = (y - screenX * b - f) / d;

    // 返回四舍五入后的屏幕坐标
    return {
      x: Math.round(screenX),
      y: Math.round(screenY),
    };
  }

  // a = scaleX
  // b = skewY
  // c = skewX
  // d = scaleY
  // e = translateX
  // f = translateY
  // 如果你没有进行旋转、缩放等复杂变换，仅仅是 translate(x, y)，则 imatrix 应该形如
  // a = 1, b = 0
  // c = 0, d = 1
  // e = -x, f = -y
  screenToCanvas(screenPos, imatrix) {
    // 解构出屏幕坐标的 x 和 y 值
    let { x, y } = screenPos;
    // 解构出逆变换矩阵的各个元素
    const { a, b, c, d, e, f } = imatrix;

    // 根据逆变换矩阵计算画布坐标的 x 值，四舍五入取整
    return {
      x: Math.round(x * a + y * c + e),
      y: Math.round(x * b + y * d + f),
    };
  }
  getCrossOn3DScreen() {
    return this.#crossOn3DScreen;
  }
  getVolume() {
    return this.#vtkSource.patientVolume;
  }
}

export default RenderEngine;

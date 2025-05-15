import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import LOCALDATA from "../util/loadLocalData.js";

// 三个容器dom
const dom1 = document.getElementById("transverse-xy");
const dom2 = document.getElementById("coronal-xz");
const dom3 = document.getElementById("sagittal-yz");

// 取内容容器宽高，计算单个视口尺寸
const contents = document.getElementsByClassName("content");
const widthC = Math.round(contents[0].clientWidth / 3);
const heightC = contents[0].clientHeight;

const InterpolationMode = {
    NEAREST: 0,
    LINEAR: 1,
    CUBIC: 2,
};

const vtkFullScreenRenderWindow = vtk.Rendering.Misc.vtkFullScreenRenderWindow;

const viewports = {
    transverse: { container: dom1 },
    coronal: { container: dom2 },
    sagittal: { container: dom3 },
};

const planes = [
    { name: "transverse", normal: [0, 0, 1], viewUp: [0, 1, 0] },
    { name: "coronal", normal: [0, 1, 0], viewUp: [0, 0, 1] },
    { name: "sagittal", normal: [1, 0, 0], viewUp: [0, 0, 1] },
];

// 用 vtkFullScreenRenderWindow 初始化每个视口，绑定已有dom容器
function initViewport (viewport) {
    const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
        rootContainer: viewport.container,
        containerStyle: { height: '100%', width: '100%' },
        background: [0, 0, 0],
    });

    // 取 renderer 和 renderWindow
    const renderer = fullScreenRenderer.getRenderer();
    const renderWindow = fullScreenRenderer.getRenderWindow();

    viewport.fullScreenRenderer = fullScreenRenderer;
    viewport.renderer = renderer;
    viewport.renderWindow = renderWindow;

    // 设置canvas尺寸
    const canvas = viewport.container.querySelector('canvas');
    if (canvas) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }
}

// 给视口设置切片actor，渲染
function setSliceActor (viewport, slice, normal, viewUp, center) {
    const renderer = viewport.renderer;
    const camera = renderer.getActiveCamera();
    console.log('slice: ', slice.getCenter(), slice.getImages(), slice.getOrigin())
    // 正确的焦点位置是数据体中心
    const distance = 500;
    const position = [
        center[0] + normal[0] * distance,
        center[1] + normal[1] * distance,
        center[2] + normal[2] * distance,
    ];

    camera.setFocalPoint(...center);
    camera.setPosition(...position);
    camera.setViewUp(...viewUp);

    renderer.addActor(slice);
    renderer.resetCameraClippingRange(); // 可选
    viewport.renderWindow.render();
}


async function start () {
    const testLocalData = await LOCALDATA.getLocalData("headerMR-26");
    console.log("finished read data", testLocalData);

    // vtkVolumeActorClass 初始化病人影像数据
    const testLocalCubeSource = new VtkVolumeActorClass(testLocalData.Para, vtk)
    const imageData = testLocalCubeSource.patientVolume;
    const extent = imageData.getExtent();
    const spacing = imageData.getSpacing(); // [sx, sy, sz]
    const origin = imageData.getOrigin();   // [ox, oy, oz]

    // 初始化每个视口
    Object.values(viewports).forEach(initViewport);

    // 获取全局参数
    let ww = Number(GPARA.ww), wl = Number(GPARA.wl), scale = GPARA.scale;
    let thickness = [Number(GPARA.thickT), Number(GPARA.thickC), Number(GPARA.thickS)];

    // 创建每个平面的切片并绑定到视口渲染
    planes.forEach((cfg, index) => {
        const reslice = vtk.Imaging.Core.vtkImageReslice.newInstance();
        reslice.setInputData(imageData);

        // 获取数据中心
        const baseCenter = [
            origin[0] + (extent[0] + extent[1]) / 2 * spacing[0],
            origin[1] + (extent[2] + extent[3]) / 2 * spacing[1],
            origin[2] + (extent[4] + extent[5]) / 2 * spacing[2],
        ];

        // 根据当前平面类型设置对应方向的中心（将slice切到当前轴向中部）
        const center = [...baseCenter];
        if (cfg.name === "transverse") {
            center[2] = origin[2] + ((extent[4] + extent[5]) / 2) * spacing[2];
        } else if (cfg.name === "coronal") {
            center[1] = origin[1] + ((extent[2] + extent[3]) / 2) * spacing[1];
        } else if (cfg.name === "sagittal") {
            center[0] = origin[0] + ((extent[0] + extent[1]) / 2) * spacing[0];
        }

        const normal = cfg.normal;
        const viewUp = cfg.viewUp;
        const right = [
            viewUp[1] * normal[2] - viewUp[2] * normal[1],
            viewUp[2] * normal[0] - viewUp[0] * normal[2],
            viewUp[0] * normal[1] - viewUp[1] * normal[0],
        ];

        const mat = new Float32Array(16);
        for (let i = 0; i < 3; i++) {
            mat[i] = right[i];
            mat[i + 4] = viewUp[i];
            mat[i + 8] = normal[i];
            mat[i + 12] = center[i];
        }
        mat[15] = 1;

        console.log(`Matrix for ${cfg.name}:`, mat);




        reslice.setInterpolationMode(InterpolationMode.LINEAR);
        reslice.setResliceAxes(mat);
        // 根据平面方向设置输出间距
        let outputSpacing = [spacing[0], spacing[1]]; // 横断位默认
        if (cfg.name === "coronal") {
            outputSpacing = [spacing[0], spacing[2]]; // X-Z方向
        } else if (cfg.name === "sagittal") {
            outputSpacing = [spacing[1], spacing[2]]; // Y-Z方向
        }
        reslice.setOutputSpacing(...outputSpacing, 1); // 第三个维度间距设为1（2D切片）
        // 根据切面法向量决定平面尺寸方向
        let iDim = 0, jDim = 1;
        if (Math.abs(normal[0]) === 1) {
            iDim = 1; jDim = 2; // sagittal (Y-Z)
        } else if (Math.abs(normal[1]) === 1) {
            iDim = 0; jDim = 2; // coronal (X-Z)
        } else if (Math.abs(normal[2]) === 1) {
            iDim = 0; jDim = 1; // transverse (X-Y)
        }

        // 计算平面上像素数量（注意 +1）
        const sizeI = extent[iDim * 2 + 1] - extent[iDim * 2] + 1;
        const sizeJ = extent[jDim * 2 + 1] - extent[jDim * 2] + 1;

        // 设置 outputExtent，完整覆盖该平面区域
        reslice.setOutputExtent(
            0, sizeI - 1,
            0, sizeJ - 1,
            0, 0 // 因为是 2D 面
        );



        const mapper = vtk.Rendering.Core.vtkImageMapper.newInstance();
        mapper.setInputConnection(reslice.getOutputPort());

        const slice = vtk.Rendering.Core.vtkImageSlice.newInstance();
        slice.setMapper(mapper);
        slice.getProperty().setColorWindow(ww);
        slice.getProperty().setColorLevel(wl);

        console.log(`${cfg.name} mapper input data dims:`, mapper.getInputData().getDimensions?.());

        setSliceActor(viewports[cfg.name], slice, normal, viewUp, center);


    });


}


start();
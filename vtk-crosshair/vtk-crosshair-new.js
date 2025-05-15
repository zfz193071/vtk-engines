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
function setSliceActor (viewport, slice) {
    const renderer = viewport.renderer;
    renderer.addActor(slice);
    renderer.resetCamera();
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

        // 计算切面矩阵
        const center = [
            origin[0] + (extent[0] + extent[1]) / 2 * spacing[0],
            origin[1] + (extent[2] + extent[3]) / 2 * spacing[1],
            origin[2] + (extent[4] + extent[5]) / 2 * spacing[2],
        ];

        const builder = vtk.Common.Core.vtkMatrixBuilder.buildFromRadian();
        const mat = builder.identity()
            .rotateFromDirections([0, 0, 1], cfg.normal)
            .translate(...center)
            .getMatrix();



        const outputData = reslice.getOutputData();
        console.log(cfg.name + 'output: ', outputData.getDimensions());  // 应该能看到非零值



        reslice.setInterpolationMode(InterpolationMode.LINEAR);

        const mapper = vtk.Rendering.Core.vtkImageMapper.newInstance();
        mapper.setInputConnection(reslice.getOutputPort());

        const slice = vtk.Rendering.Core.vtkImageSlice.newInstance();
        slice.setMapper(mapper);


        // 设置切片 actor
        setSliceActor(viewports[cfg.name], slice);

        slice.getProperty().setColorWindow(ww);
        slice.getProperty().setColorLevel(wl);


        // setResliceAxes 应该在 setOutputSpacing 之后再 render
        // 有时候 vtkImageReslice 在设置完 matrix 后，立即 setOutputSpacing 会被覆盖
        reslice.setOutputSpacing(1, 1, thickness[index]);
        reslice.setResliceAxes(mat);
    });
}

start();
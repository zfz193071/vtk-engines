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


function setCamera (camera, normal, viewUp, center, size) {
    let viewWidth = 0;
    let viewHeight = 0;

    // 根据 normal 决定哪个两个维度构成截面
    if (normal[0] === 1 || normal[0] === -1) {
        // sagittal: Y-Z 平面
        viewWidth = size[1];
        viewHeight = size[2];
    } else if (normal[1] === 1 || normal[1] === -1) {
        // coronal: X-Z 平面
        viewWidth = size[0];
        viewHeight = size[2];
    } else if (normal[2] === 1 || normal[2] === -1) {
        // transverse: X-Y 平面
        viewWidth = size[0];
        viewHeight = size[1];
    } else {
        // fallback：斜切方向，用最大值兜底
        viewWidth = Math.max(size[0], size[1]);
        viewHeight = Math.max(size[1], size[2]);
    }

    const parallelScale = 0.5 * Math.sqrt(viewWidth ** 2 + viewHeight ** 2); // 对角线一半

    camera.setParallelProjection(true);
    camera.setParallelScale(parallelScale);

    const distance = Math.max(viewWidth, viewHeight) * 1.5;
    const position = [
        center[0] + normal[0] * distance,
        center[1] + normal[1] * distance,
        center[2] + normal[2] * distance,
    ];

    camera.setFocalPoint(...center);
    camera.setPosition(...position);
    camera.setViewUp(...viewUp);
    camera.orthogonalizeViewUp();
}




function setMapperActor (mapper, scalarRange, ww, wl, vtk) {
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
    volumeProperty.setShade(false); // 关闭阴影，有助于清晰
    volumeProperty.setAmbient(0.2);
    volumeProperty.setDiffuse(0.7);
    volumeProperty.setSpecular(0.0);

    const volumeActor = vtk.Rendering.Core.vtkVolume.newInstance();
    volumeActor.setMapper(mapper);
    volumeActor.setProperty(volumeProperty);

    return volumeActor;
}


const viewports = {
    transverse: { container: dom1 },
    coronal: { container: dom2 },
    sagittal: { container: dom3 },
};

const crossSectionState = {
    center: [-0.9015999999999735, -24.22059999999999, 58.101463076923075],
    planes: [
        { name: "transverse", normal: [0, 0, 1], viewUp: [-0, -1, -0] },
        { name: "coronal", normal: [0, 1, 0], viewUp: [-0, 0, -1] },
        { name: "sagittal", normal: [1, 0, 0], viewUp: [0, 0, -1] },
    ]
};

function initViewport (viewport) {
    const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        rootContainer: viewport.container,
        containerStyle: { height: '100%', width: '100%' },
        background: [0, 0, 0],
    });

    viewport.fullScreenRenderer = fullScreenRenderer;
    viewport.renderer = fullScreenRenderer.getRenderer();
    viewport.renderWindow = fullScreenRenderer.getRenderWindow();

    const canvas = viewport.container.querySelector('canvas');
    if (canvas) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }
}

function getScalarRange (scalars) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < scalars.length; i++) {
        const val = scalars[i];
        if (val < min) min = val;
        if (val > max) max = val;
    }
    return [min, max];
}

function setVolumeWithCrossSection (viewport, imageData, ww, wl, normal, viewUp, center, scalarRange, thickness = 1.0) {
    const renderer = viewport.renderer;
    const camera = renderer.getActiveCamera();

    // 设置相机视角
    const bounds = imageData.getBounds();
    const size = [
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4],
    ];
    setCamera(camera, normal, viewUp, center, size);

    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
    mapper.setInputData(imageData);

    // 设置两个 clipping plane，形成厚度范围
    const half = thickness / 2;
    const offset = normal.map(n => n * half);

    const plane1 = vtk.Common.DataModel.vtkPlane.newInstance({
        origin: [
            center[0] - offset[0],
            center[1] - offset[1],
            center[2] - offset[2],
        ],
        normal: normal,
    });

    const plane2 = vtk.Common.DataModel.vtkPlane.newInstance({
        origin: [
            center[0] + offset[0],
            center[1] + offset[1],
            center[2] + offset[2],
        ],
        normal: normal.map(n => -n), // 反向
    });

    mapper.removeAllClippingPlanes();
    mapper.addClippingPlane(plane1);
    mapper.addClippingPlane(plane2);

    const volumeActor = setMapperActor(mapper, scalarRange, ww, wl, vtk);

    renderer.removeAllViewProps();
    renderer.addVolume(volumeActor);
    renderer.resetCameraClippingRange();
    viewport.renderWindow.render();
}

async function start () {
    const testLocalData = await LOCALDATA.getLocalData("headerMR-26");
    const testLocalCubeSource = new VtkVolumeActorClass(testLocalData.Para, vtk);
    const imageData = testLocalCubeSource.patientVolume;

    const extent = imageData.getExtent();
    const spacing = imageData.getSpacing();
    const origin = imageData.getOrigin();

    Object.values(viewports).forEach(initViewport);

    let ww = Number(GPARA.ww);
    let wl = Number(GPARA.wl);

    const scalars = imageData.getPointData().getScalars().getData();
    const scalarRange = getScalarRange(scalars);

    if (!ww || !wl || isNaN(ww) || isNaN(wl)) {
        wl = (scalarRange[1] + scalarRange[0]) / 2;
        ww = (scalarRange[1] - scalarRange[0]) / 2;
    }

    const center = crossSectionState.center;

    crossSectionState.planes.forEach(cfg => {
        setVolumeWithCrossSection(
            viewports[cfg.name],
            imageData,
            ww,
            wl,
            cfg.normal,
            cfg.viewUp,
            center,
            scalarRange,
            1.0 // 默认厚度
        );
    });
}





start();
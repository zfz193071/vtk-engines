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


const viewports = {
    transverse: { container: dom1 },
    coronal: { container: dom2 },
    sagittal: { container: dom3 },
};

const crossSectionState = {
    center: [-0.9015999999999735, -24.22059999999999, 58.101463076923075],
    planes: [
        { name: "transverse", normal: [0, 0, 1], viewUp: [0, -1, 0] },
        { name: "coronal", normal: [0, 1, 0], viewUp: [0, 0, -1] },
        { name: "sagittal", normal: [1, 0, 0], viewUp: [0, 0, -1] },
    ]
};

// ✅ 新增：根据法向量与viewUp生成局部坐标轴
function getNewAxesFromPlane (center, normal, viewUp) {
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

// ✅ 修改：支持任意方向相机摆放逻辑
function setCamera (camera, newZ, newY, center, size) {
    const viewSize = Math.max(size[0], size[1], size[2]);
    const diagonal = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2);
    const distance = diagonal * 1.5;

    const position = [
        center[0] + newZ[0] * distance,
        center[1] + newZ[1] * distance,
        center[2] + newZ[2] * distance,
    ];

    camera.setParallelProjection(true);
    camera.setParallelScale(viewSize); // 可微调比例
    camera.setFocalPoint(...center);
    camera.setPosition(...position);
    camera.setViewUp(...newY);
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
    volumeProperty.setShade(false);
    volumeProperty.setAmbient(0.2);
    volumeProperty.setDiffuse(0.7);
    volumeProperty.setSpecular(0.0);

    const volumeActor = vtk.Rendering.Core.vtkVolume.newInstance();
    volumeActor.setMapper(mapper);
    volumeActor.setProperty(volumeProperty);

    return volumeActor;
}

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

    const { newX, newY, newZ, newCenter } = getNewAxesFromPlane(center, normal, viewUp);

    const bounds = imageData.getBounds();
    const size = [
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4],
    ];
    setCamera(camera, newZ, newY, newCenter, size);

    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
    mapper.setInputData(imageData);

    // ✅ 双 clipping plane
    const half = thickness / 2;
    const offset = newZ.map(n => n * half);

    const plane1 = vtk.Common.DataModel.vtkPlane.newInstance({
        origin: [
            newCenter[0] - offset[0],
            newCenter[1] - offset[1],
            newCenter[2] - offset[2],
        ],
        normal: newZ,
    });

    const plane2 = vtk.Common.DataModel.vtkPlane.newInstance({
        origin: [
            newCenter[0] + offset[0],
            newCenter[1] + offset[1],
            newCenter[2] + offset[2],
        ],
        normal: newZ.map(n => -n),
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
            1.0
        );
    });
}

start();
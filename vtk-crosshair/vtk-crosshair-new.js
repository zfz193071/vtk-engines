import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import LOCALDATA from "../util/loadLocalData.js";
import { imageToCanvas, worldToImage } from "../util/tools.js";

// 三个容器dom
const dom1 = document.getElementById("transverse-xy");
const dom2 = document.getElementById("coronal-xz");
const dom3 = document.getElementById("sagittal-yz");
const dom3d = document.getElementById("render_3d")


const crossSectionState = {
    center: [-0.9015999999999735, -24.22059999999999, 58.101463076923075],
    planes: [
        { name: "transverse", normal: [0, 0, 1], viewUp: [0, -1, 0] },
        { name: "coronal", normal: [0, 1, 0], viewUp: [0, 0, -1] },
        { name: "sagittal", normal: [1, 0, 0], viewUp: [0, 0, -1] },
    ]
};

const viewports = {};
crossSectionState.planes.forEach(plane => {
    const name = plane.name;
    const container = {
        transverse: dom1,
        coronal: dom2,
        sagittal: dom3,
    }[name];

    viewports[name] = {
        container,
        plane,
        imageData: null,
        renderer: null,
    };
});



// 使用 world → image → canvas 显示线段
function drawProjectedLineInCanvas (viewport, worldP1, worldP2, lineAxes) {
    console.log('test worldcoord: ', worldP1, worldP2);
    const imageData = viewport.imageData;

    const canvas = viewport.container.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    const imageP1 = worldToImage(imageData, worldP1);
    const imageP2 = worldToImage(imageData, worldP2);

    console.log("test Image imageP1 imageP2: ", imageP1, imageP2);

    const [x1, y1] = imageToCanvas(imageP1, viewport, lineAxes);
    const [x2, y2] = imageToCanvas(imageP2, viewport, lineAxes);

    console.log("test canvas x1, y1, x2, y2: ", x1, y1, x2, y2);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}


function drawAllCrossLines (center) {
    const planeTriplets = [
        ['transverse', 'coronal', 'sagittal'],
        ['coronal', 'transverse', 'sagittal'],
        ['sagittal', 'transverse', 'coronal'],
    ];

    planeTriplets.forEach(([target, a, b]) => {
        const planeA = crossSectionState.planes.find(p => p.name === a);
        const planeB = crossSectionState.planes.find(p => p.name === b);
        const viewport = viewports[target];

        viewport.plane = crossSectionState.planes.find(p => p.name === target); // 当前主视图

        // 计算方向向量（法向量叉积）
        const lineDir = [
            planeA.normal[1] * planeB.normal[2] - planeA.normal[2] * planeB.normal[1],
            planeA.normal[2] * planeB.normal[0] - planeA.normal[0] * planeB.normal[2],
            planeA.normal[0] * planeB.normal[1] - planeA.normal[1] * planeB.normal[0],
        ];
        const len = 150;
        const p1 = center.map((c, i) => c - lineDir[i] * len);
        const p2 = center.map((c, i) => c + lineDir[i] * len);

        // 计算在哪两个维度上变化最大
        const absDir = lineDir.map(Math.abs);
        const sortedIndices = absDir.map((val, idx) => ({ val, idx }))
            .sort((a, b) => b.val - a.val);
        const axisI = sortedIndices[0].idx;
        const axisJ = sortedIndices[1].idx;

        drawProjectedLineInCanvas(viewport, p1, p2, [axisI, axisJ]);
    });
}



// 根据法向量与viewUp生成局部坐标轴
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

// 支持任意方向相机摆放逻辑
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
        const rect = viewport.container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
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

    // 双 clipping plane
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

function addCrossSectionActorTo3DRenderer (renderer, imageData, normal, viewUp, center, scalarRange, ww, wl, thickness = 1.0) {
    const { newX, newY, newZ, newCenter } = getNewAxesFromPlane(center, normal, viewUp);

    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
    mapper.setInputData(imageData);

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
    renderer.addVolume(volumeActor);
}
function setImageDataForAllViewports (imageData) {
    Object.values(viewports).forEach(viewport => {
        viewport.imageData = imageData;
    });
}

async function start () {
    const testLocalData = await LOCALDATA.getLocalData("headerMR-26");
    const testLocalCubeSource = new VtkVolumeActorClass(testLocalData.Para, vtk);
    const imageData = testLocalCubeSource.patientVolume;

    const scalars = imageData.getPointData().getScalars().getData();
    const scalarRange = getScalarRange(scalars);

    let ww = Number(GPARA.ww);
    let wl = Number(GPARA.wl);

    if (!ww || !wl || isNaN(ww) || isNaN(wl)) {
        wl = (scalarRange[1] + scalarRange[0]) / 2;
        ww = (scalarRange[1] - scalarRange[0]) / 2;
    }

    const center = crossSectionState.center;
    setImageDataForAllViewports(imageData);

    // ✅ 1. 初始化每个正交切面对应的 2D 视图
    Object.values(viewports).forEach(viewport => {
        initViewport(viewport);
    });

    crossSectionState.planes.forEach(cfg => {
        const viewport = viewports[cfg.name];
        setVolumeWithCrossSection(
            viewport,
            imageData,
            ww,
            wl,
            cfg.normal,
            cfg.viewUp,
            center,
            scalarRange,
            1.0
        );
        const canvas = viewport.container.querySelector('canvas');
        const [canvasWidth, canvasHeight] = [canvas.width, canvas.height];

        console.log("test canvasWidth, canvasHeight: ", canvasWidth, canvasHeight);
    });

    // ✅ 2. 初始化三维视图，叠加三个截面
    const fullScreenRenderer3D = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        rootContainer: dom3d,
        containerStyle: { width: "100%", height: "100%" },
        background: [0.1, 0.1, 0.1]
    });

    const renderer3D = fullScreenRenderer3D.getRenderer();
    const renderWindow3D = fullScreenRenderer3D.getRenderWindow();
    const camera3D = renderer3D.getActiveCamera();

    const bounds = imageData.getBounds();
    const size = [
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4],
    ];

    crossSectionState.planes.forEach(cfg => {
        addCrossSectionActorTo3DRenderer(
            renderer3D,
            imageData,
            cfg.normal,
            cfg.viewUp,
            center,
            scalarRange,
            ww,
            wl,
            1.0
        );
    });

    const diagonal = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2);
    camera3D.setFocalPoint(...center);
    camera3D.setPosition(center[0] + diagonal, center[1] + diagonal, center[2] + diagonal);
    camera3D.setViewUp(0, 0, 1);
    renderer3D.resetCamera();
    renderWindow3D.render();


    drawAllCrossLines(center);
}


start();
import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import LOCALDATA from "../util/loadLocalData.js";
const { vec3 } = glMatrix
import { canvasToImage, imageToWorld, getLineWithoutBounds, getAxisMapFromCamera, worldToImage, getNewAxesFromPlane, getScalarRange, rotateVector, setMapperActor } from "../util/tools.js";

// 三个容器dom
const contents = document.getElementsByClassName("content")
const dom1 = document.getElementById("transverse-xy");
const dom2 = document.getElementById("coronal-xz");
const dom3 = document.getElementById("sagittal-yz");
const dom3d = document.getElementById("render_3d")

const widthC = Math.round(contents[0].clientWidth / 3) - 2
const heightC = contents[0].clientHeight - 2

const rangeSize = [widthC, heightC]


const crossSectionState = {
    center: [-0.5, -20, 30],
    planes: [
        { name: "transverse", normal: [0, 0.7071, 0.7071], viewUp: [0, -1, 0] },
        { name: "coronal", normal: [0.7071, 0.7071, 0], viewUp: [0, 0, -1] },
        { name: "sagittal", normal: [1, 0, 0], viewUp: [0, 0, -1] },
    ]
};
const lineColors = {
    transverse: "#8a00da", // purple
    coronal: "#cd9700",    // orange
    sagittal: "#3470d8",   // blue
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
        newAxes: null,
    };
});

// Object.defineProperty(crossSectionState, 'value', {
//     get () {
//         return this._value;
//     },
//     set (newValue) {
//         this._value = newValue;
//     }
// });


// 使用 world → image → canvas 显示线段
function drawProjectedLineInCanvas (viewport, worldP1, worldP2, color = 'red') {
    console.log("test viewport plane: ", viewport.plane.name);
    console.log('test worldcoord: ', worldP1, worldP2);

    const canvas = viewport.container.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    let displayCoords1 = viewport.renderer.worldToNormalizedDisplay(
        worldP1[0],
        worldP1[1],
        worldP1[2],
        widthC / heightC,
    );

    let displayCoords2 = viewport.renderer.worldToNormalizedDisplay(
        worldP2[0],
        worldP2[1],
        worldP2[2],
        widthC / heightC,
    );


    let x1 = displayCoords1[0] * widthC
    let y1 = (1 - displayCoords1[1]) * heightC

    let x2 = displayCoords2[0] * widthC
    let y2 = (1 - displayCoords2[1]) * heightC


    console.log("test canvas x1, y1, x2, y2: ", x1, y1, x2, y2);

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();


}


function drawAllCrossLines (center) {
    const planeNames = ['transverse', 'coronal', 'sagittal'];
    planeNames.forEach(target => {
        const viewport = viewports[target];
        viewport.plane = crossSectionState.planes.find(p => p.name === target);


        const canvas = viewport.container.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const targetNormal = viewport.plane.normal;
        const otherPlanes = planeNames.filter(name => name !== target);

        otherPlanes.forEach(otherName => {
            const otherPlane = crossSectionState.planes.find(p => p.name === otherName);

            // 交线方向
            const dir = [
                targetNormal[1] * otherPlane.normal[2] - targetNormal[2] * otherPlane.normal[1],
                targetNormal[2] * otherPlane.normal[0] - targetNormal[0] * otherPlane.normal[2],
                targetNormal[0] * otherPlane.normal[1] - targetNormal[1] * otherPlane.normal[0],
            ];

            const magnitude = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
            if (magnitude < 1e-6) {
                console.warn(`Skipped line from ${target} ∩ ${otherName}, zero direction vector`);
                return;
            }

            const unitDir = dir.map(d => d / magnitude);

            const clipped = getLineWithoutBounds(center, unitDir);
            if (!clipped) {
                console.warn(`投影线 ${target} ∩ ${otherName} 完全在体积外，跳过`);
                return;
            }

            const [worldP1, worldP2] = clipped;
            const color = lineColors[otherName];
            drawProjectedLineInCanvas(viewport, worldP1, worldP2, color);
        });
    });

}


// 支持任意方向相机摆放逻辑
function setCamera (camera, newZ, newY, center, size, viewportSize) {
    const diagonal = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2);
    const distance = diagonal * 1.5;

    const position = [
        center[0] + newZ[0] * distance,
        center[1] + newZ[1] * distance,
        center[2] + newZ[2] * distance,
    ];

    const [w, h] = viewportSize;
    const spacing = Math.max(size[0] / w, size[1] / h);
    const scale = spacing * Math.max(w, h) / 2;

    camera.setParallelProjection(true);
    camera.setParallelScale(scale); // 自动适配视口
    camera.setFocalPoint(...center);
    camera.setPosition(...position);
    camera.setViewUp(...newY);
    camera.orthogonalizeViewUp();
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

    const container = viewport.container;
    container.style.width = rangeSize[0] + 'px';
    container.style.height = rangeSize[1] + 'px';

    const canvas = viewport.container.querySelector('canvas');
    if (canvas) {
        canvas.width = rangeSize[0]
        canvas.height = rangeSize[1];
        const rect = viewport.container.getBoundingClientRect();
        viewport.container.querySelector('div').style.width = rangeSize[0] + 'px';
        viewport.container.querySelector('div').style.height = rangeSize[1] + 'px';

        const axisMapLookup = {
            transverse: [0, 1],
            coronal: [0, 2],
            sagittal: [1, 2],
        };
        viewport.axisMap = axisMapLookup[viewport.plane.name];

        const bounds = viewport.imageData.getBounds();
        // 反算出图像坐标
        const [i, j] = viewport.axisMap;
        const worldWidth = bounds[2 * i + 1] - bounds[2 * i];   // i 轴方向在世界坐标系的长度
        const worldHeight = bounds[2 * j + 1] - bounds[2 * j];
        const pixelSpacingX = worldWidth / widthC;
        const pixelSpacingY = worldHeight / heightC;

        viewport.pixelSpacingX = pixelSpacingX;
        viewport.pixelSpacingY = pixelSpacingY;



        canvas.addEventListener('click', event => {
            const canvasX = event.clientX - rect.left;
            const canvasY = event.clientY - rect.top;

            const deltaX = canvasX - canvas.width / 2;
            const deltaY = -(canvasY - canvas.height / 2);


            const offsetWorld = [0, 0, 0];
            for (let i = 0; i < 3; i++) {
                offsetWorld[i] =
                    deltaX * pixelSpacingX * viewport.newAxes.newX[i] +
                    deltaY * pixelSpacingY * viewport.newAxes.newY[i];
            }

            const clickWorld = [0, 0, 0];
            for (let i = 0; i < 3; i++) {
                clickWorld[i] = crossSectionState.center[i] + offsetWorld[i];
            }

            crossSectionState.center = clickWorld;

            drawAllCrossLines(clickWorld);
        });
    }
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
    const viewportSize = [rangeSize[0], rangeSize[1]];
    setCamera(camera, newZ, newY, newCenter, size, viewportSize);

    viewport.newAxes = { newX, newY, newZ };
    console.log('当前视图对应切片 index：', imageData.worldToIndex(center));


    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
    mapper.setInputData(imageData);

    // 双 clipping plane
    const half = thickness / 2;
    const offset = newZ.map(n => n * half);

    console.log("test offset: ", offset, newZ);

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
    renderer.resetCamera();
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

    //初始化每个正交切面对应的 2D 视图
    Object.values(viewports).forEach(viewport => {
        initViewport(viewport);
    });

    crossSectionState.planes.forEach(cfg => {
        const viewport = viewports[cfg.name];
        viewport.scalarRange = scalarRange;
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




    // const testImageCoord = worldToImage(imageData, center);
    // console.log("test1 testImageCoord: ", testImageCoord);
    // const testCanvasCoord = imageToCanvas(testImageCoord, viewports.transverse, [0, 1]);
    // console.log("test1 testCanvasCoord: ", testCanvasCoord);
    // console.log("test1 image w : ", testCanvasCoord[0], testCanvasCoord[1]);
    drawAllCrossLines(center);

    const diagonal = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2);
    camera3D.setFocalPoint(...center);
    camera3D.setPosition(center[0] + diagonal, center[1] + diagonal, center[2] + diagonal);
    camera3D.setViewUp(0, 0, 1);
    renderer3D.resetCamera();
    renderWindow3D.render();
}


start();
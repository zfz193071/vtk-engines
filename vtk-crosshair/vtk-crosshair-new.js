import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import LOCALDATA from "../util/loadLocalData.js";
const { vec3 } = glMatrix
import { canvasToImage, imageToWorld, getLineWithinBounds, getAxisMapFromCamera, worldToImage, getNewAxesFromPlane, getScalarRange, rotateVector, setMapperActor } from "../util/tools.js";

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
        { name: "transverse", normal: [0, 0, 1], viewUp: [0, -1, 0] },
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

function imageToCanvas (imageCoord, planeName) {
    const size3D = [512, 512, 26];

    let imageSize2D;
    if (planeName === "transverse") {
        // xy平面
        imageSize2D = [size3D[0], size3D[1]];
    } else if (planeName === "coronal") {
        // xz平面
        imageSize2D = [size3D[0], size3D[2]];
    } else if (planeName === "sagittal") {
        // yz平面
        imageSize2D = [size3D[1], size3D[2]];
    } else {
        throw new Error(`Unsupported plane name: ${planeName}`);
    }

    const [imageU, imageV] = imageCoord;
    const [imageWidth, imageHeight] = imageSize2D;

    // 注意image坐标和canvas坐标的原点和方向要匹配，通常都是左上角为(0,0)，Y向下

    // 计算缩放比例
    const scaleX = widthC / imageWidth;
    const scaleY = heightC / imageHeight;

    const canvasX = imageU * scaleX;
    const canvasY = imageV * scaleY;

    return [canvasX, canvasY];
}


// 使用 world → image → canvas 显示线段
function drawProjectedLineInCanvas (viewport, worldP1, worldP2, color = 'red') {
    console.log("test viewport plane: ", viewport.plane.name);
    console.log('test worldcoord: ', worldP1, worldP2);

    // const worldCenter = crossSectionState.center;


    const imageData = viewport.imageData;
    const canvas = viewport.container.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // const imageP1 = worldToImage(worldP1, viewport);
    // const imageP2 = worldToImage(worldP2, viewport);
    // const imageCenter = worldToImage(imageData, worldCenter);
    // console.log("test imagecenter: ", imageCenter);

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


    // console.log("test Image imageP1 imageP2: ", imageP1, imageP2);

    // const [x1, y1] = imageToCanvas(imageP1, viewport.plane.name);
    // const [x2, y2] = imageToCanvas(imageP2, viewport.plane.name);

    // const [x3, y3] = imageToCanvas(imageCenter, viewport.plane.name);

    console.log("test canvas x1, y1, x2, y2: ", x1, y1, x2, y2);

    // console.log("test canvas x3, y3: ", x3, y3);


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
    const axisMapLookup = {
        transverse: [0, 1],
        coronal: [0, 2],
        sagittal: [1, 2],
    };
    const origin = [-140.908, -164.227, 2.71689];
    const spacing = [0.5469, 0.5469, 5.538457307692307];
    const extent = [0, 511, 0, 511, 0, 25];
    const bounds = [
        origin[0], origin[0] + spacing[0] * (extent[1] - extent[0]),
        origin[1], origin[1] + spacing[1] * (extent[3] - extent[2]),
        origin[2], origin[2] + spacing[2] * (extent[5] - extent[4]),
    ];

    // const bounds = imageData.getBounds(); // 放在最外层，只计算一次

    planeNames.forEach(target => {
        const viewport = viewports[target];
        viewport.plane = crossSectionState.planes.find(p => p.name === target);
        viewport.axisMap = axisMapLookup[target];
        console.log("test new axisMap: ", viewport.axisMap);

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

            // 自动根据 image bounds 获取能完全落在体积内的线段
            const clipped = getLineWithinBounds(center, unitDir, bounds);
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

        // canvas.addEventListener('click', event => {
        //     const canvasX = event.clientX - rect.left;
        //     const canvasY = event.clientY - rect.top;

        //     // 反算出图像坐标
        //     const [i, j] = viewport.axisMap;

        //     // 反转 canvas → image
        //     const imageCoord = canvasToImage(canvasX, canvasY, viewport, viewport.axisMap);

        //     // 重构完整 image 坐标
        //     const imageIndex = [0, 0, 0];
        //     imageIndex[i] = imageCoord[0];
        //     imageIndex[j] = imageCoord[1];
        //     // 第三个轴使用当前 crossSectionState.center 上的 image 坐标
        //     const centerImageCoord = worldToImage(viewport.imageData, crossSectionState.center);
        //     const k = [0, 1, 2].filter(a => a !== i && a !== j)[0];
        //     imageIndex[k] = centerImageCoord[k];

        //     // 转换成 world 坐标
        //     const worldCoord = imageToWorld(viewport.imageData, imageIndex);

        //     // 更新中心点
        //     crossSectionState.center = worldCoord;

        //     // ✅ 重新绘制投影线
        //     drawAllCrossLines(worldCoord);
        // });
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
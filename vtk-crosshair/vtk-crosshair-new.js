import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import LOCALDATA from "../util/loadLocalData.js";
const { vec3 } = glMatrix
import { canvasToImage, imageToWorld, imageToCanvas, getLineWithinBounds, worldToImage, getNewAxesFromPlane, getScalarRange, rotateVector, setMapperActor } from "../util/tools.js";

// 三个容器dom
const dom1 = document.getElementById("transverse-xy");
const dom2 = document.getElementById("coronal-xz");
const dom3 = document.getElementById("sagittal-yz");
const dom3d = document.getElementById("render_3d")


const crossSectionState = {
    center: [-0.5, -20, 30],
    planes: [
        { name: "transverse", normal: [0, 0, 1], viewUp: [0, -1, 0] },
        { name: "coronal", normal: [0, 1, 0], viewUp: [0, 0, -1] },
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


// 使用 world → image → canvas 显示线段
function drawProjectedLineInCanvas (viewport, worldP1, worldP2, color = 'red') {
    console.log("test viewport plane: ", viewport.plane.name);
    console.log('test worldcoord: ', worldP1, worldP2);

    const imageData = viewport.imageData;
    const canvas = viewport.container.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    const imageP1 = worldToImage(imageData, worldP1);
    const imageP2 = worldToImage(imageData, worldP2);

    console.log("test Image imageP1 imageP2: ", imageP1, imageP2);
    console.log("test axisMap: ", viewport.axisMap);

    const [x1, y1] = imageToCanvas(imageP1, viewport, viewport.axisMap);
    const [x2, y2] = imageToCanvas(imageP2, viewport, viewport.axisMap);

    console.log("test canvas x1, y1, x2, y2: ", x1, y1, x2, y2);

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const offsetDistance = 40; // 以 canvas 像素为单位，调整这个值控制距离
    const dx = x1 - x2;
    const dy = y1 - y2;
    const length = Math.sqrt(dx * dx + dy * dy);

    // 归一化方向向量，防止长度为0
    const ux = length === 0 ? 0 : dx / length;
    const uy = length === 0 ? 0 : dy / length;

    // 计算偏移点坐标
    const dotX = x2 + ux * offsetDistance;
    const dotY = y2 + uy * offsetDistance;

    // 画圆点
    // ctx.beginPath();
    // ctx.arc(dotX, dotY, 6, 0, 2 * Math.PI);
    // ctx.fillStyle = color;
    // ctx.fill();
    // ctx.restore();
    // registerDraggablePoint(viewport, { x: x2, y: y2 }, worldP2, color);
}

function registerDraggablePoint (viewport, screenPos, worldPos, color, targetViewportType) {
    const canvas = viewport.container.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();

    const state = {
        dragging: false,
        startScreen: null,
        startWorld: null,
        viewport,
        color,
    };

    const onMouseDown = (e) => {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - screenPos.x;
        const dy = y - screenPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 8) { // 可调距离
            state.dragging = true;
            state.startScreen = [x, y];
            state.startWorld = [...worldPos];
        }
    };

    const onMouseMove = (e) => {
        if (!state.dragging) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const [i, j] = viewport.axisMap;
        const imageCoord = canvasToImage(x, y, viewport, viewport.axisMap);
        const imageIndex = [0, 0, 0];
        imageIndex[i] = imageCoord[0];
        imageIndex[j] = imageCoord[1];

        const centerImageCoord = worldToImage(viewport.imageData, crossSectionState.center);
        const k = [0, 1, 2].filter(a => a !== i && a !== j)[0];
        imageIndex[k] = centerImageCoord[k];

        const newWorld = imageToWorld(viewport.imageData, imageIndex);

        const v1 = vec3.sub([], state.startWorld, crossSectionState.center);
        const v2 = vec3.sub([], newWorld, crossSectionState.center);

        const axis = vec3.cross([], v1, v2);
        const angle = vec3.angle(v1, v2);

        if (vec3.length(axis) < 1e-6 || angle === 0) {
            return;
        }

        vec3.normalize(axis, axis);

        // ✅ 获取目标类型的 viewport（而非事件 viewport）
        const targetViewport = getViewportByType(targetViewportType);
        const targetPlane = targetViewport.plane;

        // ✅ 计算旋转后的法向量和 up 向量
        const newNormal = rotateVector(targetPlane.normal, axis, angle);
        const newViewUp = rotateVector(targetPlane.viewUp, axis, angle);

        // ✅ 更新 plane（仅角度变化，不更新 center）
        targetPlane.normal = newNormal;
        targetPlane.viewUp = newViewUp;

        crossSectionState.plane = targetPlane; // 如果有用到可以保留

        setVolumeWithCrossSection(
            targetViewport,
            targetViewport.imageData,
            targetPlane.ww,
            targetPlane.wl,
            newNormal,
            newViewUp,
            crossSectionState.center,
            targetViewport.scalarRange
        );

        drawAllCrossLines(crossSectionState.center); // 重绘线
    };

    const onMouseUp = () => {
        state.dragging = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
}

function drawAllCrossLines (center) {
    const planeNames = ['transverse', 'coronal', 'sagittal'];
    const axisMapLookup = {
        transverse: [0, 1],
        coronal: [0, 2],
        sagittal: [1, 2],
    };
    // const origin = [-140.908, -164.227, 2.71689];
    // const spacing = [0.5469, 0.5469, 5.538457307692307];
    // const extent = [0, 511, 0, 511, 0, 25];
    // const bounds = [
    //     origin[0], origin[0] + spacing[0] * (extent[1] - extent[0]),
    //     origin[1], origin[1] + spacing[1] * (extent[3] - extent[2]),
    //     origin[2], origin[2] + spacing[2] * (extent[5] - extent[4]),
    // ];

    // const bounds = imageData.getBounds(); // 放在最外层，只计算一次

    planeNames.forEach(target => {
        const viewport = viewports[target];
        const bounds = viewport.imageData.getBounds();
        viewport.plane = crossSectionState.planes.find(p => p.name === target);
        viewport.axisMap = axisMapLookup[target];

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
    setCamera(camera, newZ, newY, newCenter, size);
    console.log('当前视图对应切片 index：', imageData.worldToIndex(center));


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

    const diagonal = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2);
    camera3D.setFocalPoint(...center);
    camera3D.setPosition(center[0] + diagonal, center[1] + diagonal, center[2] + diagonal);
    camera3D.setViewUp(0, 0, 1);
    renderer3D.resetCamera();
    renderWindow3D.render();


    drawAllCrossLines(center);
}


start();
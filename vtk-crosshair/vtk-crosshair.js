/*
 * @Author: 
 * @Date: 2023-11-22 10:43:13
 * @LastEditTime: 2023-12-27 17:59:18
 * @LastEditors: ssy
 * @Description: 
 */

import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import RenderEngine from "../util/renderEngine.js";
import DataWithInfo from "../util/tDataWithInfo.js";
import LOCALDATA from "../util/loadLocalData.js";
const { mat4 } = glMatrix;

// 定义新的参数结构
const crossSectionState = {
    center: [128, 128, 60],
    planes: {
        axial: {
            normal: [0, 0, 1],
            viewUp: [0, -1, 0],
            matrix: null
        },
        sagittal: {
            normal: [1, 0, 0],
            viewUp: [0, 0, 1],
            matrix: null
        },
        coronal: {
            normal: [0, 1, 0],
            viewUp: [0, 0, 1],
            matrix: null
        }
    }
};

// 重采样矩阵
function buildResliceAxes (normal, viewUp, center) {
    const vtkMath = vtk.Common.Core.vtkMath;
    const x = vtkMath.cross([], viewUp, normal);
    vtkMath.normalize(x);
    const y = viewUp;
    const z = normal;

    return [
        x[0], x[1], x[2], 0,
        y[0], y[1], y[2], 0,
        z[0], z[1], z[2], 0,
        center[0], center[1], center[2], 1,
    ];
}

// 更新截面矩阵
function updateSectionMatrices () {
    for (const planeKey in crossSectionState.planes) {
        const { normal, viewUp } = crossSectionState.planes[planeKey];
        crossSectionState.planes[planeKey].matrix = buildResliceAxes(normal, viewUp, crossSectionState.center);
    }
}

// 获取开关元素
const orthogonalToggle = document.getElementById('ORTHO_MODE');

// 监听开关状态变化
orthogonalToggle.addEventListener('change', function () {
    const isChecked = this.checked;
    // 遍历所有视图端口
    for (let key in viewportsKeys) {
        viewports[viewportsKeys[key]].renderEngine.setOrthogonalRotation(isChecked);
    }
    // 重新渲染
    renderAll();
});

//初始化render
const contents = document.getElementsByClassName("content");
const dom1 = document.getElementById("transverse-xy");
const dom2 = document.getElementById("coronal-xz");
const dom3 = document.getElementById("sagittal-yz");
const dom3d = document.getElementById("render_3d");
const widthC = Math.round(contents[0].clientWidth / 3);
const heightC = contents[0].clientHeight;

let view3D = null;

const renderInit = {
    backgroupCanvas: "#000",
    borderColor: "#fff",
    rangeSize: [widthC, heightC]
};
const viewports = {
    "transverse-xy": {
        renderEngine: new RenderEngine(dom1, renderInit, GPARA)
    },
    "coronal-xz": {
        renderEngine: new RenderEngine(dom2, renderInit, GPARA)
    },
    "sagittal-yz": {
        renderEngine: new RenderEngine(dom3, renderInit, GPARA)
    },
    // "3d-view": {
    //     renderEngine: new RenderEngine(dom3d, renderInit, GPARA),
    // }
};

const viewportsKeys = Object.keys(viewports);

// for (let key in viewportsKeys) {
//     viewports[viewportsKeys[key]].renderEngine.setOrthogonalRotation(orthogonalToggle.checked);
//     const viewId = viewportsKeys[key];
//     if (viewId !== '3d') {
//         addCrosshairTo2D(viewId, viewports[viewId], viewports);
//     }
// }

const Selectors = document.getElementsByClassName("optSelector");
let currentSelectorName = null;
//增加点击监听
for (let i = 0; i < Selectors.length; i++) {
    Selectors[i].addEventListener("click", function () {
        selectOpt(this);
    });
    if (Selectors[i].getAttribute("name") === currentSelectorName) {
        Selectors[i].checked = true;
    }
}

function selectOpt (dom) {
    console.log("selectOpt", dom);
    let name = dom.getAttribute("name");
    if (name === currentSelectorName) {
        return;
    }
    currentSelectorName = name;
    for (let i = 0; i < Selectors.length; i++) {
        Selectors[i].checked = false;
    }
    dom.checked = true;
    for (let key in viewportsKeys) {
        viewports[viewportsKeys[key]].renderEngine.getCatcher().setCurOpt(name);
    }
}

Object.defineProperty(GPARA, 'value', {
    get: function () {
        return this._value;
    },
    set: function (newValue) {
        //这里全局监听GPARA
        this._value = newValue;
        // console.log('监听到渲染参数', newValue);
        //渲染组件上的值
        let keys = Object.keys(newValue);
        keys.forEach((ikey) => {
            let dom = document.getElementById(ikey);
            if (dom && dom.value !== newValue[ikey]) {
                dom.value = newValue[ikey];
            }
        });
        // if (view3D.draw3DCrosshair) {
        //     view3D.draw3DCrosshair();
        //     view3D.renderWindow.render();
        // }
        // update3DVolumeTransform(newValue)
        renderAll();
    }
});

//全局变量
let seriesInfo, testData, localFlag = true, patientVolume, testActor;

function renderAll_2D () {
    console.time("vtk-crosshair");
    let ww = Number(GPARA.ww), wl = Number(GPARA.wl), scale = GPARA.scale;
    let thickness = [Number(GPARA.thickT), Number(GPARA.thickC), Number(GPARA.thickS)];
    let crossPosOnImage = [Number(GPARA.pageS), Number(GPARA.pageC), Number(GPARA.pageT)];

    let rotateAngelGlobal = [Number(GPARA.rotateT) * Math.PI / 180, Number(GPARA.rotateC) * Math.PI / 180, Number(GPARA.rotateS) * Math.PI / 180];
    const ThicknessDic = ["thickS", "thickC", "thickT"];
    for (let i = 0; i < 3; i++) {
        let renderEngine = viewports[viewportsKeys[i]].renderEngine;
        renderEngine.setWWWL(ww, wl);
        renderEngine.setCurrenViewMod(i);
        renderEngine.setImageReslice(crossPosOnImage, thickness, rotateAngelGlobal);
        renderEngine.setScale2D(scale);
        renderEngine.render2d();
    }
    //获取数组
    console.timeEnd("vtk-crosshair");// 约为20ms
}

function renderAll_3D () {
    let ww = Number(GPARA.ww), wl = Number(GPARA.wl), scale = GPARA.scale;
    let thickness = [Number(GPARA.thickT), Number(GPARA.thickC), Number(GPARA.thickS)];
    let crossPosOnImage = [Number(GPARA.pageS), Number(GPARA.pageC), Number(GPARA.pageT)];
    let rotateAngelGlobal = [Number(GPARA.rotateT) * Math.PI / 180, Number(GPARA.rotateC) * Math.PI / 180, Number(GPARA.rotateS) * Math.PI / 180];
    for (let i = 0; i < viewportsKeys.length; i++) {
        let key = viewportsKeys[i];
        viewports[key].renderEngine.setWWWL(ww, wl);
        viewports[key].renderEngine.setCurrenViewMod(i);
        // viewports[key].renderEngine.setCross(crossPosOnImage, thickness, rotateAngelGlobal)
        viewports[key].renderEngine.setScale3D(scale, rotateAngelGlobal);
        viewports[key].renderEngine.render3d();
    }
}

function renderAll () {
    updateSectionMatrices();
    renderAll_2D();
    renderAll_3D();
    updateAllViews(viewports);
}

async function start () {
    console.log("test vtk-crosshair start");
    const testLocalData = await LOCALDATA.getLocalData("headerMR-26");
    console.log("finished read data", testLocalData);
    // testLocalData.Para.BlendMode = 1
    const testLocalCube_transverse = new VtkVolumeActorClass(testLocalData.Para, vtk);
    viewports["transverse-xy"].renderEngine.setMapperActor(testLocalCube_transverse);
    const testLocalCube_coronal = new VtkVolumeActorClass(testLocalData.Para, vtk);
    viewports["coronal-xz"].renderEngine.setMapperActor(testLocalCube_coronal);
    const testLocalCube_sagittal = new VtkVolumeActorClass(testLocalData.Para, vtk);
    viewports["sagittal-yz"].renderEngine.setMapperActor(testLocalCube_sagittal);
    const testLocaCube3d = new VtkVolumeActorClass(testLocalData.Para, vtk);
    //初始化操作
    selectOpt(Selectors[Selectors.length - 1]);
    //3D渲染
    // render3DVR(testLocaCube3d.Actor)
    render3DView();

    renderAll();
    updateAllViews(viewports);
}

function render3DVR (actor) {
    const dom3d = document.getElementById("render_3d");
    const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        rootContainer: dom3d,
        containerStyle: {
            height: '100%',
            width: '100%'
        },
        background: [0, 0, 0]
    });
    const renderer = fullScreenRenderer.getRenderer();
    renderer.addVolume(actor);
    const renderWindow = fullScreenRenderer.getRenderWindow();
    renderer.resetCamera();
    renderWindow.render();
    console.log('3d render finished');
}

function updateAllViews (viewports) {
    Object.entries(viewports).forEach(([id, v]) => {
        if (!v.renderEngine) return;
        const planeKey = getPlaneKeyFromId(id);
        const { matrix } = crossSectionState.planes[planeKey];
        v.renderEngine.getReslice().setResliceAxes(matrix);
        v.renderEngine.getReslice().modified();
        v.renderEngine.getRendererWindow().render();
    });
}

function getPlaneKeyFromId (id) {
    if (id.includes('xy')) return 'axial';
    if (id.includes('xz')) return 'coronal';
    if (id.includes('yz')) return 'sagittal';
    return 'axial';
}

function addCrosshairTo2D (viewId, viewport, viewports) {
    const planeKey = getPlaneKeyFromId(viewId);
    const center = crossSectionState.center;
    const otherPlanes = Object.keys(crossSectionState.planes).filter(k => k !== planeKey);
    const renderer = viewport.renderEngine.getRenderer();
    const renderWindow = viewport.renderEngine.getRendererWindow();
    const container = viewport.renderEngine.getContainer(); // 获取渲染容器用于事件监听

    // 创建投影线
    otherPlanes.forEach(planeName => {
        const { normal } = crossSectionState.planes[planeName];

        // 计算与法线正交的方向
        let dir1 = [1, 0, 0];
        if (Math.abs(normal[0]) > 0.9) {
            dir1 = [0, 1, 0];
        }

        const dir2 = vtk.Common.Core.vtkMath.cross(normal, dir1, []);
        vtk.Common.Core.vtkMath.normalize(dir2);

        // 创建十字线的两条线段
        const createLine = (direction) => {
            const lineLength = 1000;
            const p1 = center.map((c, i) => c - direction[i] * lineLength);
            const p2 = center.map((c, i) => c + direction[i] * lineLength);

            const lineSource = vtk.Filters.Sources.vtkLineSource.newInstance();
            lineSource.setPoint1(p1);
            lineSource.setPoint2(p2);

            const mapper = vtk.Rendering.Core.vtkMapper.newInstance();
            mapper.setInputConnection(lineSource.getOutputPort());

            const actor = vtk.Rendering.Core.vtkActor.newInstance();
            actor.setMapper(mapper);
            actor.getProperty().setColor(1, 0, 0); // 红色
            actor.getProperty().setLineWidth(2);

            return actor;
        };

        // 添加投影线到渲染器
        const lines = [createLine(dir1), createLine(dir2)];
        lines.forEach(line => renderer.addActor(line));
    });

    // 创建可交互的十字线中心标记
    const createMarker = () => {
        const sphereSource = vtk.Filters.Sources.vtkSphereSource.newInstance();
        sphereSource.setRadius(5); // 标记点大小
        sphereSource.setCenter(center);

        const mapper = vtk.Rendering.Core.vtkMapper.newInstance();
        mapper.setInputConnection(sphereSource.getOutputPort());

        const actor = vtk.Rendering.Core.vtkActor.newInstance();
        actor.setMapper(mapper);
        actor.getProperty().setColor(1, 1, 0); // 黄色
        actor.getProperty().setOpacity(0.8); // 半透明

        return actor;
    };

    const markerActor = createMarker();
    renderer.addActor(markerActor);

    // 交互状态
    let isDragging = false;
    let dragStartPos = null;
    let initialCenter = [...center];

    // 屏幕坐标转世界坐标
    function screenToWorld (screenPos) {

        // 使用 vtkCoordinate 进行坐标转换
        const vtkCoordinate = vtk.Rendering.Core.vtkCoordinate.newInstance();
        vtkCoordinate.setCoordinateSystemToDisplay();
        vtkCoordinate.setValue(screenPos.x, screenPos.y, 0);

        return vtkCoordinate.getComputedWorldValue(renderer);
    }

    // 世界坐标转屏幕坐标
    function worldToScreen (worldPos) {
        const vtkCoordinate = vtk.Rendering.Core.vtkCoordinate.newInstance();
        vtkCoordinate.setCoordinateSystemToWorld();
        vtkCoordinate.setValue(worldPos[0], worldPos[1], worldPos[2]);

        return vtkCoordinate.getComputedDisplayValue(renderer);
    }

    // 检查鼠标是否在标记点附近
    function isNearMarker (screenPos) {
        const markerScreenPos = worldToScreen(center);
        const dx = screenPos.x - markerScreenPos[0];
        const dy = screenPos.y - markerScreenPos[1];
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < 15; // 可点击范围半径
    }

    // 更新十字线位置
    function updateCrosshairPosition (newCenter) {
        crossSectionState.center = newCenter;
        markerActor.setCenter(newCenter);
        updateSectionMatrices();
        updateAllViews(viewports);
    }

    // 鼠标按下事件
    function handleMouseDown (e) {
        const screenPos = { x: e.clientX, y: e.clientY };

        if (isNearMarker(screenPos)) {
            isDragging = true;
            dragStartPos = screenPos;
            initialCenter = [...center];
            container.style.cursor = 'grabbing'; // 改变光标样式

            // 防止默认行为和事件冒泡
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // 鼠标移动事件
    function handleMouseMove (e) {
        if (!isDragging) return;

        const screenPos = { x: e.clientX, y: e.clientY };
        const deltaX = screenPos.x - dragStartPos.x;
        const deltaY = screenPos.y - dragStartPos.y;

        // 获取当前平面的法向量
        const { normal } = crossSectionState.planes[planeKey];

        // 计算移动向量 (简化版，实际应基于相机和平面)
        const camera = renderer.getActiveCamera();
        const viewUp = camera.getViewUp();
        const right = vtk.Common.Core.vtkMath.cross([], normal, viewUp);
        vtk.Common.Core.vtkMath.normalize(right);

        // 基于屏幕移动计算世界坐标的变化
        const worldDelta = [
            right[0] * deltaX + viewUp[0] * deltaY,
            right[1] * deltaX + viewUp[1] * deltaY,
            right[2] * deltaX + viewUp[2] * deltaY
        ];

        // 计算新的中心点 (保持在当前平面上)
        const newCenter = [
            initialCenter[0] + worldDelta[0],
            initialCenter[1] + worldDelta[1],
            initialCenter[2] + worldDelta[2]
        ];

        // 更新十字线位置
        updateCrosshairPosition(newCenter);
    }

    // 鼠标释放事件
    function handleMouseUp () {
        if (isDragging) {
            isDragging = false;
            container.style.cursor = 'default'; // 恢复光标样式
        }
    }

    // 注册事件监听器
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp); // 鼠标离开容器时也释放拖拽

    // 渲染窗口
    renderWindow.render();

    // 返回清理函数，用于移除事件监听器
    return () => {
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseUp);
    };
}

function render3DView () {
    const renderer = vtk.Rendering.Core.vtkRenderer.newInstance();
    const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
    renderWindow.addRenderer(renderer);

    const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
    openGLRenderWindow.setContainer(dom3d);
    openGLRenderWindow.setSize(dom3d.clientWidth, dom3d.clientHeight);
    renderWindow.addView(openGLRenderWindow);

    const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
    interactor.setView(openGLRenderWindow);
    interactor.initialize();
    interactor.bindEvents(dom3d);

    const interactorStyle = vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance();
    interactor.setInteractorStyle(interactorStyle);

    // 初始化 view3D 对象
    view3D = {
        renderWindow,
        renderer,
        GLWindow: openGLRenderWindow,
        interactor,
        widgetManager: null,
        orientationWidget: null,
        outlineActor: null // 存储outline actor的引用
    };
    renderer.getActiveCamera().setParallelProjection(true);
    renderer.setBackground(0.5, 0.5, 0.5);

    const transverseActor = viewports["transverse-xy"].renderEngine.getActor(); // z轴切片
    const coronalActor = viewports["coronal-xz"].renderEngine.getActor();       // y轴切片
    const sagittalActor = viewports["sagittal-yz"].renderEngine.getActor();     // x轴切片

    renderer.addActor(transverseActor);
    renderer.addActor(coronalActor);
    renderer.addActor(sagittalActor);

    // 添加体数据的outline
    // const imageData = viewports["transverse-xy"].renderEngine.getVolume(); // 获取图像数据
    // if (imageData) {
    //     // 创建一个图像外边界的包围盒（Outline）
    //     const outline = vtk.Filters.General.vtkOutlineFilter.newInstance();
    //     outline.setInputData(imageData);

    //     // 创建 mapper（映射器），把 outline 几何映射成 WebGL 可以渲染的数据
    //     const outlineMapper = vtk.Rendering.Core.vtkMapper.newInstance();
    //     outlineMapper.setInputData(outline.getOutputData());

    //     // 创建 actor，并添加到 3D 渲染器中
    //     const outlineActor = vtk.Rendering.Core.vtkActor.newInstance();
    //     outlineActor.setMapper(outlineMapper);
    //     outlineActor.getProperty().setColor(1, 1, 1); // 设置为白色
    //     outlineActor.getProperty().setLineWidth(2);   // 设置线宽

    //     renderer.addActor(outlineActor);
    //     view3D.outlineActor = outlineActor; // 保存引用以便后续操作
    // }

    renderer.resetCamera();
    renderer.resetCameraClippingRange();
    renderWindow.render();

    view3D.viewMode = 0;
}

start();
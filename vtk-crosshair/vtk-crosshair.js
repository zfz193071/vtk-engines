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
import { getNewAxesFromPlane, setMapperActor } from '../util/tools.js';
const { mat4 } = glMatrix

window.isOrthogonalRotation = false
//初始化render
const contents = document.getElementsByClassName("content")
const dom1 = document.getElementById("transverse-xy")
const dom2 = document.getElementById("coronal-xz")
const dom3 = document.getElementById("sagittal-yz")
const widthC = Math.round(contents[0].clientWidth / 3)
const heightC = contents[0].clientHeight

const renderInit = {
    backgroupCanvas: "#000",
    borderColor: "#fff",
    rangeSize: [widthC, heightC]
}
const viewports = {
    "transverse-xy": {
        renderEngine: new RenderEngine(dom1, renderInit, GPARA, "transverse-xy")
    },
    "coronal-xz": {
        renderEngine: new RenderEngine(dom2, renderInit, GPARA, "coronal-xz")
    },
    "sagittal-yz": {
        renderEngine: new RenderEngine(dom3, renderInit, GPARA, "sagittal-yz")
    }
}

const viewportsKeys = Object.keys(viewports)

const Selectors = document.getElementsByClassName("optSelector")
let currentSelectorName = null

document.getElementById("ORTHO_MODE").addEventListener("change", function (e) {
    window.isOrthogonalRotation = e.target.checked
})

let imageData = null
//增加点击监听
for (let i = 0; i < Selectors.length; i++) {
    Selectors[i].addEventListener("click", function () {
        selectOpt(this)
    })
    if (Selectors[i].getAttribute("name") === currentSelectorName) {
        Selectors[i].checked = true
    }


}

function selectOpt (dom) {
    console.log("selectOpt", dom)
    let name = dom.getAttribute("name")
    if (name === currentSelectorName) {
        return
    }
    currentSelectorName = name
    for (let i = 0; i < Selectors.length; i++) {
        Selectors[i].checked = false
    }
    dom.checked = true
    for (let key in viewportsKeys) {
        viewports[viewportsKeys[key]].renderEngine.getCatcher().setCurOpt(name)
    }
}

Object.defineProperty(GPARA, 'value', {
    get: function () {
        return this._value;
    },
    set: function (newValue) {
        //这里全局监听GPARA
        this._value = newValue;
        console.log('监听到渲染参数', newValue);
        //渲染组件上的值
        let keys = Object.keys(newValue)
        keys.forEach((ikey) => {
            let dom = document.getElementById(ikey)
            if (dom && dom.value !== newValue[ikey]) {
                dom.value = newValue[ikey]
            }
        })
        renderAll()
    }
});




function renderAll_2D () {
    console.time("vtk-crosshair")
    let ww = Number(GPARA.ww), wl = Number(GPARA.wl), scale = GPARA.scale
    let thickness = [Number(GPARA.thickT), Number(GPARA.thickC), Number(GPARA.thickS)]
    let crossPosOnImage = [Number(GPARA.pageS), Number(GPARA.pageC), Number(GPARA.pageT)]

    let rotateAngelGlobal = [Number(GPARA.rotateT) * Math.PI / 180, Number(GPARA.rotateC) * Math.PI / 180, Number(GPARA.rotateS) * Math.PI / 180]
    const ThicknessDic = ["thickS", "thickC", "thickT"]
    for (let i = 0; i < 3; i++) {
        let renderEngine = viewports[viewportsKeys[i]].renderEngine
        renderEngine.setWWWL(ww, wl)
        renderEngine.setCurrenViewMod(i)
        renderEngine.setImageReslice(crossPosOnImage, thickness, rotateAngelGlobal)
        renderEngine.setScale2D(scale)
        renderEngine.render2d()
    }
    //获取数组
    console.timeEnd("vtk-crosshair")// 约为20ms
}
function renderAll_3D () {
    let ww = Number(GPARA.ww), wl = Number(GPARA.wl), scale = GPARA.scale
    let thickness = [Number(GPARA.thickT), Number(GPARA.thickC), Number(GPARA.thickS)]
    let crossPosOnImage = [Number(GPARA.pageS), Number(GPARA.pageC), Number(GPARA.pageT)]
    let rotateAngelGlobal = [Number(GPARA.rotateT) * Math.PI / 180, Number(GPARA.rotateC) * Math.PI / 180, Number(GPARA.rotateS) * Math.PI / 180]
    for (let i = 0; i < viewportsKeys.length; i++) {
        let key = viewportsKeys[i]
        viewports[key].renderEngine.setImageData(imageData)
        viewports[key].renderEngine.setWWWL(ww, wl)
        viewports[key].renderEngine.setCurrenViewMod(i)
        viewports[key].renderEngine.setCross(crossPosOnImage, thickness, rotateAngelGlobal)
        viewports[key].renderEngine.setScale3D(scale, rotateAngelGlobal)
        viewports[key].renderEngine.render3d()
    }
}

function renderAll () {
    renderAll_2D()
    renderAll_3D()
    render3DVR()
}


async function start () {
    console.log("test vtk-crosshair start")
    const testLocalData = await LOCALDATA.getLocalData("headerMR-26")
    console.log("finished read data", testLocalData)
    // testLocalData.Para.BlendMode = 1
    const testLocalCube_transverse = new VtkVolumeActorClass(testLocalData.Para, vtk)
    viewports["transverse-xy"].renderEngine.setMapperActor(testLocalCube_transverse)
    const testLocalCube_coronal = new VtkVolumeActorClass(testLocalData.Para, vtk)
    viewports["coronal-xz"].renderEngine.setMapperActor(testLocalCube_coronal)
    const testLocalCube_sagittal = new VtkVolumeActorClass(testLocalData.Para, vtk)
    viewports["sagittal-yz"].renderEngine.setMapperActor(testLocalCube_sagittal)
    const testLocaCube3d = new VtkVolumeActorClass(testLocalData.Para, vtk)

    imageData = testLocaCube3d.patientVolume
    //初始化操作
    selectOpt(Selectors[Selectors.length - 1])
    renderAll()
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


let fullScreenRenderer3D = null;
let renderer3D = null;
let renderWindow3D = null;
let camera3D = null;

// 初始化渲染器，只做一次
function init3DRenderer () {
    if (!fullScreenRenderer3D) {
        const view3d = document.getElementById("render_3d");
        fullScreenRenderer3D = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
            rootContainer: view3d,
            containerStyle: {
                height: '100%',
                width: '100%'
            },
            background: [0.1, 0.1, 0.1]
        });
        renderer3D = fullScreenRenderer3D.getRenderer();
        renderWindow3D = fullScreenRenderer3D.getRenderWindow();
        camera3D = renderer3D.getActiveCamera();
    }
}
function render3DVR () {
    // 只初始化一次
    init3DRenderer();

    // 清空旧内容（关键！）
    renderer3D.removeAllViewProps();

    const worldCenter = GPARA.crossSectionState.center;
    const sphereRadius = 10; // 设定你想要的半径

    // 创建小球
    const sphereSource = vtk.Filters.Sources.vtkSphereSource.newInstance({
        center: worldCenter,
        radius: sphereRadius,
        thetaResolution: 32,
        phiResolution: 32
    });
    const sphereMapper = vtk.Rendering.Core.vtkMapper.newInstance();
    sphereMapper.setInputConnection(sphereSource.getOutputPort());
    const sphereActor = vtk.Rendering.Core.vtkActor.newInstance();
    sphereActor.setMapper(sphereMapper);
    sphereActor.getProperty().setColor(0.9, 0.1, 0.1);
    sphereActor.getProperty().setOpacity(0.7);
    renderer3D.addActor(sphereActor);

    const bounds = imageData.getBounds();
    const size = [
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4],
    ];
    const scalars = imageData.getPointData().getScalars().getData();
    const scalarRange = getScalarRange(scalars);

    let ww = Number(GPARA.ww);
    let wl = Number(GPARA.wl);
    if (!ww || !wl || isNaN(ww) || isNaN(wl)) {
        wl = (scalarRange[1] + scalarRange[0]) / 2;
        ww = (scalarRange[1] - scalarRange[0]) / 2;
    }
    const center = GPARA.crossSectionState.center;
    GPARA.crossSectionState.planes.forEach(cfg => {
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

    console.log('3d render finished');
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
start()

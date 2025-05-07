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
const { mat4 } = glMatrix

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
        renderEngine: new RenderEngine(dom1, renderInit, GPARA)
    },
    "coronal-xz": {
        renderEngine: new RenderEngine(dom2, renderInit, GPARA)
    },
    "sagittal-yz": {
        renderEngine: new RenderEngine(dom3, renderInit, GPARA)
    }
}

const viewportsKeys = Object.keys(viewports)

for (let key in viewportsKeys) {
    viewports[viewportsKeys[key]].renderEngine.setOrthogonalRotation(orthogonalToggle.checked);
}

const Selectors = document.getElementsByClassName("optSelector")
let currentSelectorName = null
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
        // console.log('监听到渲染参数', newValue);
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

//全局变量
let seriesInfo, testData, localFlag = true, patientVolume, testActor


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
    //初始化操作
    selectOpt(Selectors[Selectors.length - 1])
    //3D渲染
    render3DVR(testLocaCube3d.Actor)
    renderAll()
}
function render3DVR (actor) {
    const view3d = document.getElementById("render_3d");
    const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        rootContainer: view3d,
        containerStyle: {
            height: '100%',
            width: '100%'
        },
        background: [0, 0, 0]
    })
    const renderer = fullScreenRenderer.getRenderer()
    renderer.addVolume(actor)
    const renderWindow = fullScreenRenderer.getRenderWindow()
    renderer.resetCamera()
    renderWindow.render()
    console.log('3d render finished')
}

start()
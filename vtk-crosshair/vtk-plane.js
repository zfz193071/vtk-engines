/*
 * @Author: 
 * @Date: 2023-11-27 17:16:48
 * @LastEditTime: 2023-11-28 18:51:51
 * @LastEditors: ssy
 * @Description: 
 */
import LOCALDATA from "../util/loadLocalData.js";
const testLocalData = await LOCALDATA.getLocalData("headerCT-165")
import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
testLocalData.Para.ww = 100
testLocalData.Para.wl = 40
testLocalData.Para.BlendMode =1
const testLocaCube = new VtkVolumeActorClass(testLocalData.Para, vtk)

const viewport = document.getElementById("viewport");
const fullRenderWindow = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
    rootContainer: viewport,
    containerStyle: {
        height: '100%',
        overflow: 'hidden'
    },
    background: [0, 0, 0]
});
const renderer = fullRenderWindow.getRenderer();
const renderWindow = fullRenderWindow.getRenderWindow();
let page1 = 100
let page2 = -120
let page =1
//定义两个平面
const vtkPlane = vtk.Common.DataModel.vtkPlane
const clipPlane1 = vtkPlane.newInstance();
const clipPlane2 = vtkPlane.newInstance();

function render3DVR(actor) {
    const view3d = document.getElementById("render_3d");
    const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        rootContainer: view3d,
        containerStyle: {
            height: '100%',
            overflow: 'hidden'
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

function testPlane() {
    //横断面
    let clipPlaneNormal1 = [0, 0, 1];
    let clipPlaneNormal2 = [0, 0, -1];

    let clipPosition1 = page1 
    let clipPosition2 = page2
    let clipPlaneOrigin1 = [clipPlaneNormal1[0] * clipPosition1, clipPlaneNormal1[1] * clipPosition1, clipPlaneNormal1[2] * clipPosition1];
    let clipPlaneOrigin2 = [clipPlaneNormal2[0] * clipPosition2, clipPlaneNormal2[1] * clipPosition2, clipPlaneNormal2[2] * clipPosition2];
    clipPlane1.setNormal(clipPlaneNormal1);
    clipPlane1.setOrigin(clipPlaneOrigin1);
    clipPlane2.setNormal(clipPlaneNormal2);
    clipPlane2.setOrigin(clipPlaneOrigin2);

    renderWindow.render()
}


function start() {
    testPlane(testLocaCube.patientVolume, 100)
    testLocaCube.Mapper.addClippingPlane(clipPlane1);
    testLocaCube.Mapper.addClippingPlane(clipPlane2);
    renderer.addVolume(testLocaCube.Actor)
    renderer.resetCamera()
    // render3DVR(testLocaCube.Actor)
    document.getElementById("setPage1").addEventListener("input", e => {
        page1 = Number(e.target.value)
        console.log("监听到值变化")
        testPlane()
    })
    document.getElementById("setPage2").addEventListener("input", e => {
        page2 = Number(e.target.value)
        console.log("监听到值变化")
        testPlane()
    })
    document.getElementById("setPage").addEventListener("input", e => {
        let patientVolume = testLocaCube.patientVolume
        page = Number(e.target.value)
        let volumeOrigin = patientVolume.getOrigin()
        let volumeSize = patientVolume.getDimensions()
        let volumeSpacing = patientVolume.getSpacing()
        let theckness = 1
        let pos1 = volumeOrigin[2] + (volumeSize[2]-page) * volumeSpacing[2]-theckness/2
        let pos2 = -(volumeOrigin[2] + (volumeSize[2]-page) * volumeSpacing[2] + theckness/2)
        console.log("监听到值变化")
        console.log("page",page,"pos1",pos1,"pos2",pos2)
        page1 = pos1
        page2= pos2
        testPlane()
    })
}

start()

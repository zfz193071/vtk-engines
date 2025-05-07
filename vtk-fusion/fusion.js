/*
 * @Author: 
 * @Date: 2023-09-07 09:46:45
 * @LastEditTime: 2023-09-11 16:55:00
 * @LastEditors: ssy
 * @Description: 
 * imageData
 */


import CubeDataClass from '../util/cubeData.js';
import VtkVolumeActorClass from '../util/vtkVolumeActor.js';
import DATA from './data.js';
let {ctParaInit,ptParaInit} = DATA
ctParaInit.dataType= vtk.Common.Core.vtkDataArray.VtkDataTypes.SHORT
ptParaInit.dataType= vtk.Common.Core.vtkDataArray.VtkDataTypes.SHORT

const ctPara = new CubeDataClass(ctParaInit).Para
const ptPara = new CubeDataClass(ptParaInit).Para


const ctActor = new VtkVolumeActorClass(ctPara,vtk).Actor
const ptActor = new VtkVolumeActorClass(ptPara,vtk).Actor


const view3d = document.getElementById("mainW");
const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
    rootContainer: view3d,
    containerStyle: {
      height: '100%',
      overflow: 'hidden'
    },
    background: [0, 0, 0]
})

const renderer = fullScreenRenderer.getRenderer()
renderer.addVolume(ctActor)
renderer.addVolume(ptActor)
const renderWindow = fullScreenRenderer.getRenderWindow()
let interactor = fullScreenRenderer.getInteractor();
interactor.unbindEvents()
renderer.resetCamera()
renderWindow.render()

//测试鼠标控制和相机
const camera = renderer.getActiveCamera()

//测试picker
const picker = vtk.Rendering.Core.vtkPicker.newInstance()
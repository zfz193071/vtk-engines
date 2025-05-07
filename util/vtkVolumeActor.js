/*
 * @Author: 
 * @Date: 2023-09-11 15:44:31
 * @LastEditTime: 2024-01-08 12:55:40
 * @LastEditors: ssy
 * @Description: 
 */
import COLORMAP from './colormap.js'
const { mat4 } = glMatrix
class VtkVolumeActorClass {
  constructor(para, vtk, keepOrthogonality = true) {
    const { name, dataType, initVolumeBuf, size, origin, pixcelSpacing, BlendMode, ww, wl, colormapIndex, opacity } = para
    // console.log(name,dataType,size,origin,pixcelSpacing,BlendMode,ww, wl, colormapIndex, opacity)
    const Scalars = vtk.Common.Core.vtkDataArray.newInstance({
      size: size[0] * size[1] * size[2],
      dataType: dataType,
      name: name,
    })
    Scalars.setData(initVolumeBuf, 1)
    let initVolume = vtk.Common.DataModel.vtkImageData.newInstance()
    initVolume.setOrigin(origin)
    initVolume.setSpacing(pixcelSpacing[0], pixcelSpacing[1], pixcelSpacing[2])
    initVolume.setExtent(0, size[0] - 1, 0, size[1] - 1, 0, size[2] - 1)
    initVolume.getPointData().setScalars(Scalars)
    const ifReverce = false
    if (ifReverce) {
      //反转，得到头上脚下的数据
      console.time("reverce to get patientVolume")
      console.log("翻转前 origin", initVolume.getOrigin())
      const imageReverce = vtk.Imaging.Core.vtkImageReslice.newInstance();
      imageReverce.setInputData(initVolume);
      const axes = mat4.identity(new Float64Array(16));
      mat4.rotateY(axes, axes, Math.PI);
      imageReverce.setResliceAxes(axes)
      imageReverce.setInterpolationMode("Linear")
      // 添加 setKeepOrthogonality 配置
      imageReverce.setKeepOrthogonality(false);
      initVolume = imageReverce.getOutputData()
      console.timeEnd("reverce to get patientVolume")
      console.log("翻转后 origin", initVolume.getOrigin())
    }
    let patientVolume = initVolume
    const ifReslice = false
    if (ifReslice) {
      //重采样+旋转，得到Patient坐标系下同分辨率的数据，目前暂时不考虑旋转
      console.time("reslice to get patientVolume")
      const imageReslice = vtk.Imaging.Core.vtkImageReslice.newInstance();
      imageReslice.setInputData(initVolume);
      imageReslice.setInterpolationMode("Linear")
      let { curSize, curSpacing } = this.getSamlePara(size, pixcelSpacing)
      imageReslice.setOutputSpacing(curSpacing[0], curSpacing[1], curSpacing[2])
      imageReslice.setOutputExtent(0, curSize[0] - 1, 0, curSize[1] - 1, 0, curSize[2] - 1)
      imageReverce.setKeepOrthogonality(false);
      patientVolume = imageReslice.getOutputData()
      console.timeEnd("reslice to get patientVolume")
    }
    const Mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance()
    Mapper.setInputData(patientVolume)
    Mapper.setSampleDistance((Math.min(pixcelSpacing[0], pixcelSpacing[1], pixcelSpacing[2])) / 2)
    Mapper.setMaximumSamplesPerRay(4000);
    Mapper.setPreferSizeOverAccuracy(true);
    Mapper.setBlendMode(BlendMode);

    const Actor = vtk.Rendering.Core.vtkVolume.newInstance()
    Actor.setMapper(Mapper)
    this.initProps(Actor.getProperty(), ww, wl, colormapIndex, opacity, vtk);

    this.Actor = Actor
    this.Mapper = Mapper
    this.initVolume = initVolume
    this.patientVolume = patientVolume
    this.Scalars = Scalars
    this.renderWindow = null
  }
  getSamlePara (orgSize, orgSpacing) {
    const MAXSIZE = 300
    let worldSize = orgSize.map((item, index) => item * orgSpacing[index])
    let minSpcing = Math.min(...orgSpacing)
    let tempSize = worldSize.map(item => item / minSpcing)
    let maxSizeNow = Math.max(...tempSize)
    if (maxSizeNow < MAXSIZE) {
      //可以直接以当前的最小分辨率重采样
      return {
        curSize: tempSize,
        curSpacing: [minSpcing, minSpcing, minSpcing]
      }
    } else {
      //保证最大边长只有512
      let scale = maxSizeNow / MAXSIZE
      return {
        curSize: tempSize.map(item => Math.round(item / scale)),
        curSpacing: [minSpcing * scale, minSpcing * scale, minSpcing * scale]
      }
    }
  }
  initProps (property, ww, wl, colormapIndex, opacity, vtk) {
    property.setRGBTransferFunction(0, this.newColorFunction(ww, wl, colormapIndex, vtk));
    property.setScalarOpacity(0, this.newOpacityFunction(ww, wl, opacity, vtk));
    // property.setInterpolationTypeToLinear();
    property.setInterpolationTypeToFastLinear();
    property.setShade(true);
    //这个参数不能随便设置，会导致渲染的数据出现黑色的噪点
    property.setScalarOpacityUnitDistance(0, 4.5);
    property.setUseGradientOpacity(0, true);
    property.setGradientOpacityMinimumValue(0, 0, 1);
    property.setGradientOpacityMinimumOpacity(0, 0.0);
    property.setGradientOpacityMaximumValue(0, 1);
    property.setGradientOpacityMaximumOpacity(0, 1.0);
    property.setAmbient(0.2);
    property.setDiffuse(0.7);
    property.setSpecular(0.3);
    property.setSpecularPower(8.0);
  }
  newColorFunction (ww, wl, colormapIndex, vtk) {
    let _COLOR = COLORMAP[colormapIndex]
    let fun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
    let bottom = wl - ww / 2
    let top = wl + ww / 2
    if (colormapIndex === "B&W") {
      fun.addRGBSegment(bottom, 0, 0, 0, top, 1.0, 1.0, 1.0);
    } else {
      for (let i = 0; i < 256; i++) {
        let value = (i - 0) / 256 * (top - bottom) + bottom
        let r = _COLOR[i][0] / 255
        let g = _COLOR[i][1] / 255
        let b = _COLOR[i][2] / 255

        fun.addRGBPoint(value, r, g, b);
      }
    }
    return fun;
  }

  newOpacityFunction (ww, wl, opacity, vtk) {
    let bottom = wl - ww / 2
    let top = wl + ww / 2
    var fun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
    fun.addPoint(bottom, opacity);
    fun.addPoint(top, opacity);
    return fun;
  }

  setWWWL (ww, wl, colormapIndex) {
    const property = this.Actor.getProperty();
    property.setRGBTransferFunction(0, this.newColorFunction(ww, wl, colormapIndex, vtk));
    property.setScalarOpacity(0, this.newOpacityFunction(ww, wl, 1, vtk));
  }
}

export default VtkVolumeActorClass
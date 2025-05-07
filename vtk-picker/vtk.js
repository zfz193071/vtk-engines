const macro = vtk.macro;
const vtkCompositeCameraManipulator = vtk.Interaction.Manipulators.vtkCompositeCameraManipulator;
const vtkCompositeMouseManipulator = vtk.Interaction.Manipulators.vtkCompositeMouseManipulator;
// ----------------------------------------------------------------------------
// vtkMouseCameraTrackballRotateManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseCameraTrackballRotateManipulator(publicAPI, model) {
    // Set our className
    model.classHierarchy.push('MouseCameraTrackballRotateManipulator');
    publicAPI.onButtonDown = (interactor, renderer, position) => {
        model.previousPosition = position;
        picker.pick([position.x, position.y, 0.0], renderer)
    };

    publicAPI.onMouseMove = (interactor, renderer, position) => {
        if (!position) {
            return;
        }

        if (!model.previousPosition) {
            return;
        }

        const rwi = interactor;

        const dx = position.x - model.previousPosition.x;
        const dy = position.y - model.previousPosition.y;

        const size = rwi.getView().getViewportSize(renderer);

        let deltaElevation = -0.1;
        let deltaAzimuth = -0.1;
        if (size[0] && size[1]) {
            deltaElevation = -20.0 / size[1];
            deltaAzimuth = -20.0 / size[0];
        }

        // const rxf = dx * deltaAzimuth * model.motionFactor;
        // const ryf = dy * deltaElevation * model.motionFactor;
        const rxf = dx * deltaAzimuth * 1;
        const ryf = dy * deltaElevation * 1;

        const camera = renderer.getActiveCamera();
        if (!Number.isNaN(rxf) && !Number.isNaN(ryf)) {
            camera.azimuth(rxf);
            camera.elevation(ryf);
            camera.orthogonalizeViewUp();
        }
        if (model.autoAdjustCameraClippingRange) {
            renderer.resetCameraClippingRange();
        }

        if (rwi.getLightFollowCamera()) {
            renderer.updateLightsGeometryToFollowCamera();
        }
    };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
};

// ----------------------------------------------------------------------------

function extend(publicAPI, model, initialValues = {}) {
    Object.assign(model, DEFAULT_VALUES, initialValues);

    // Inheritance
    macro.obj(publicAPI, model);
    vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues);
    vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues);

    // Create get-set macro

    // Object specific methods
    vtkMouseCameraTrackballRotateManipulator(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance = macro.newInstance(
    extend,
    'MouseCameraTrackballRotateManipulator'
);

// ----------------------------------------------------------------------------

let MouseCameraTrackballRotateManipulator = {
    newInstance,
    extend
}
const vtkDataArray = vtk.Common.Core.vtkDataArray;
const VtkDataTypes = vtkDataArray.VtkDataTypes;
const vtkImageData = vtk.Common.DataModel.vtkImageData;
const vtkColorTransferFunction = vtk.Rendering.Core.vtkColorTransferFunction;
const vtkFullScreenRenderWindow = vtk.Rendering.Misc.vtkFullScreenRenderWindow;
const vtkGenericRenderWindow = vtk.Rendering.Misc.vtkGenericRenderWindow;
const vtkHttpDataSetReader = vtk.IO.Core.vtkHttpDataSetReader;
const vtkPiecewiseFunction = vtk.Common.DataModel.vtkPiecewiseFunction;
const vtkPiecewiseGaussianWidget = vtk.Interaction.Widgets.vtkPiecewiseGaussianWidget;
const vtkVolume = vtk.Rendering.Core.vtkVolume;
const vtkVolumeMapper = vtk.Rendering.Core.vtkVolumeMapper;
const vtkPicker = vtk.Rendering.Core.vtkPicker;
const vtkInteractorStyleManipulator = vtk.Interaction.Style.vtkInteractorStyleManipulator;
const vtkMouseCameraTrackballZoomManipulator = vtk.Interaction.Manipulators.vtkMouseCameraTrackballZoomManipulator;


const vtkColorMaps = vtk.Rendering.Core.vtkColorTransferFunction.vtkColorMaps;
const vtkPiecewiseFunctionProxy = vtk.Proxy.Core.vtkPiecewiseFunctionProxy;
const vtkLookupTableProxy = vtk.Proxy.Core.vtkLookupTableProxy;
const { getDiagonalLength } = vtk.Common.DataModel.vtkBoundingBox;

const THUMBNAIL_SIZE = 80;
import _COLORPRESETS from '../../../src/assets/js/MedicalColorPresets.js'
let local_rgbPresetNames = []
for (let i = 0; i < _COLORPRESETS.length; i++) {
    local_rgbPresetNames.push(_COLORPRESETS[i].Name)
}
function local_getPresetByName(presetName) {
    let preObj = _COLORPRESETS.find(ele => ele.Name === presetName)
    return preObj
}

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------
const rootContainer = document.querySelector(
    '.vtk-js-example-piecewise-gaussian-widget'
);
const catcher = document.querySelector('.catcher')
const containerStyle = rootContainer ? { height: '100%' } : null;
const urlToLoad = rootContainer
    ? rootContainer.dataset.url ||
    'https://kitware.github.io/vtk-js/data/volume/LIDC2.vti'
    : `${__BASE_PATH__}/data/volume/LIDC2.vti`;

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    background: [0, 0, 0],
    rootContainer,
    containerStyle,
});
const interactorStyle = vtkInteractorStyleManipulator.newInstance();
const interator = fullScreenRenderer.getInteractor();
interator.setInteractorStyle(interactorStyle);
const uiComponents = {};
uiComponents["leftButton"] = {
    manipName: "Rotate",
};
uiComponents["rightButton"] = {
    manipName: "Zoom",
};
uiComponents["scrollMiddleButton"] = {
    manipName: "Zoom",
};
const selectMap = {
    leftButton: { button: 1 },
    middleButton: { button: 2 },
    rightButton: { button: 3 },
    scrollMiddleButton: { scrollEnabled: true, dragEnabled: false },
};

const manipulatorFactory = {
    Zoom: vtkMouseCameraTrackballZoomManipulator,
    Rotate: MouseCameraTrackballRotateManipulator,
}

function reassignManipulators(interactorStyle) {
    interactorStyle.removeAllMouseManipulators();
    Object.keys(uiComponents).forEach((keyName) => {
        const klass = manipulatorFactory[uiComponents[keyName].manipName];
        if (klass) {
            const manipulator = klass.newInstance();
            manipulator.setButton(selectMap[keyName].button);

            if (selectMap[keyName].scrollEnabled !== undefined) {
                manipulator.setScrollEnabled(selectMap[keyName].scrollEnabled);
            }
            if (selectMap[keyName].dragEnabled !== undefined) {
                manipulator.setDragEnabled(selectMap[keyName].dragEnabled);
            }
            interactorStyle.addMouseManipulator(manipulator);
        }
    });
}
reassignManipulators(interactorStyle);






const renderer = fullScreenRenderer.getRenderer();
const camera = renderer.getActiveCamera();
// 设置冻结焦点 如果不设置默认右键缩放会重置焦点使旋转出错
camera.setFreezeFocalPoint(true)
renderer.resetCamera();
let distance = camera.getDistance();
renderer.updateLightsGeometryToFollowCamera();
const renderWindow = fullScreenRenderer.getRenderWindow();

renderWindow.getInteractor().setDesiredUpdateRate(15.0);
// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------

const body = rootContainer || document.querySelector('body');

// Create Widget container
const widgetContainer = document.createElement('div');
widgetContainer.style.position = 'absolute';
widgetContainer.style.top = 'calc(10px + 1em)';
widgetContainer.style.left = '500px';
widgetContainer.style.background = 'rgba(255, 255, 255, 0.3)';

// Create Label for preset
const labelContainer = document.createElement('div');
labelContainer.style.position = 'absolute';
labelContainer.style.top = '5px';
labelContainer.style.left = '5px';
labelContainer.style.width = '100%';
labelContainer.style.color = 'white';
labelContainer.style.textAlign = 'center';
labelContainer.style.userSelect = 'none';
labelContainer.style.cursor = 'pointer';
body.appendChild(labelContainer);

let presetIndex = 0;
const globalDataRange = [0, 255];
const lookupTable = vtkColorTransferFunction.newInstance();
const piecewiseFunction = vtkPiecewiseFunction.newInstance();
// 切换视图颜色
function changePreset(delta = 0) {
    presetIndex =
        (presetIndex + delta + local_rgbPresetNames.length) %
        local_rgbPresetNames.length;
    lookupTable.applyColorMap(
        local_getPresetByName(local_rgbPresetNames[presetIndex])
    );
    lookupTable.setMappingRange(...globalDataRange);
    lookupTable.updateRange();
    labelContainer.innerHTML = local_rgbPresetNames[presetIndex];
}
let intervalID = null;
function stopInterval() {
    if (intervalID !== null) {
        clearInterval(intervalID);
        intervalID = null;
    }
}

labelContainer.addEventListener('click', (event) => {
    if (event.pageX < 200) {
        stopInterval();
        changePreset(-1);
    } else {
        stopInterval();
        changePreset(1);
    }
});
function changePresetByClick(e) {
    let name = e.alt
    lookupTable.applyColorMap(
        local_getPresetByName(name)
    );
    lookupTable.setMappingRange(...globalDataRange);
    lookupTable.updateRange();
    labelContainer.innerHTML = local_rgbPresetNames[presetIndex];
}

// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------

const widget = vtkPiecewiseGaussianWidget.newInstance({
    numberOfBins: 256,
    size: [400, 150],
});
widget.updateStyle({
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    histogramColor: 'rgba(100, 100, 100, 0.5)',
    strokeColor: 'rgb(0, 0, 0)',
    activeColor: 'rgb(255, 255, 255)',
    handleColor: 'rgb(50, 150, 50)',
    buttonDisableFillColor: 'rgba(255, 255, 255, 0.5)',
    buttonDisableStrokeColor: 'rgba(0, 0, 0, 0.5)',
    buttonStrokeColor: 'rgba(0, 0, 0, 1)',
    buttonFillColor: 'rgba(255, 255, 255, 1)',
    strokeWidth: 2,
    activeStrokeWidth: 3,
    buttonStrokeWidth: 1.5,
    handleWidth: 3,
    iconSize: 20, // Can be 0 if you want to remove buttons (dblClick for (+) / rightClick for (-))
    padding: 10,
});

fullScreenRenderer.setResizeCallback(({ width, height }) => {
    widget.setSize(Math.min(450, width - 10), 150);
});



const actor = vtkVolume.newInstance();
const mapper = vtkVolumeMapper.newInstance({ sampleDistance: 1.1 });
const picker = vtkPicker.newInstance()
let arr = ['BkBu', "BkCy", "BkGn"]
arr = local_rgbPresetNames
const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
reader.setUrl(urlToLoad).then(() => {
    reader.loadData().then(() => {
        const imageData = reader.getOutputData();
        const dataArray = imageData.getPointData().getScalars();
        const dataRange = dataArray.getRange();
        globalDataRange[0] = dataRange[0];
        globalDataRange[1] = dataRange[1];

        // Update Lookup table
        changePreset();
        // Automatic switch to next preset every 5s
        if (!rootContainer) {
            intervalID = setInterval(changePreset, 5000);
        }

        widget.setDataArray(dataArray.getData());
        widget.applyOpacity(piecewiseFunction);

        widget.setColorTransferFunction(lookupTable);
        lookupTable.onModified(() => {
            widget.render();
            renderWindow.render();
        });
        actor.setMapper(mapper);

        mapper.setInputData(imageData);
        mapper.setBlendMode(1);
        mapper.setMaximumSamplesPerRay(2000);
        mapper.setVolumetricScatteringBlending(0)
        mapper.setGlobalIlluminationReach(0.5);
        mapper.setLocalAmbientOcclusion(true);
        mapper.setLAOKernelSize(3);
        mapper.setLAOKernelRadius(6);
        actor.getProperty().setRGBTransferFunction(0, lookupTable);
        actor.getProperty().setScalarOpacity(0, piecewiseFunction);
        actor.getProperty().setInterpolationTypeToFastLinear();
        renderer.addVolume(actor);
        renderer.resetCamera();
        renderer.getActiveCamera().elevation(70);
        picker.addPickList(actor)
        picker.setTolerance(0.0005)
        renderWindow.render();
        return imageData;
    }).then(data => {
        // for (let i = 0; i < arr.length; i++) {
        //     let name = arr[i];
        //     useVolumeThumbnailing(THUMBNAIL_SIZE, name, data).then(res => {
        //         let img = document.getElementById(`img${i + 1}`);
        //         img.src = res;
        //         img.alt = name
        //         img.addEventListener('click', (event) => {

        //             changePresetByClick(event.target)
        //         });
        //     });
        // }
    });
});


let dirList =
    [
        "6352aa014e682b477fc33d09",//884张磁共振
        "6352a8314e682b477fc2a4ff",//884张磁共振
        "6352a8754e682b477fc2bac5",//CT
        "636d22be2d8afc77a43f2d70",//测试vr效果
    ]

let pathPrefix = "http://127.0.0.1:6010/public/DICOM/"

let path = dirList[3]
let imageList = []

function dicomParser_loadSingleData(index, max) {
    let url = `${pathPrefix}${path}/${index}.dcm`
    axios.get(url, { responseType: "arraybuffer" }).then((resp) => {
        let dataArr = new Uint8Array(resp.data)
        let dataSet = dicomParser.parseDicom(dataArr);
        let dataWidth = dataSet.int16("x00280010")
        let dataHeight = dataSet.int16("x00280011")
        let slope = dataSet.floatString("x00281053") ? dataSet.floatString("x00281053") : 1
        let intercept = dataSet.floatString("x00281052") ? dataSet.floatString("x00281052") : 0
        console.log(dataWidth, dataHeight, slope, intercept)
        var pixelDataElement = dataSet.elements.x7fe00010;
        var pixelData = new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);
        dataArr = null
        dataSet = null
        // pixelData = null
        imageList[index - 1] = { width: dataWidth, height: dataHeight, data: pixelData }
        if (index + 1 <= max) {
            dicomParser_loadSingleData(index + 1, max)

        } else {
            console.log("load data finished")
            initImageDataForVTK()
        }
    }).catch((err) => {
        console.log(err)
    })
}

function initImageDataForVTK() {
    let volumeData = []
    for (let i = 0; i < imageList.length; i++) {
        let data = imageList[i].data
        for (let j = 0; j < data.length; j++) {
            volumeData.push(data[j])
        }
    }
    let width = imageList[0].width, height = imageList[0].height, depth = imageList.length
    var scalars = vtkDataArray.newInstance({
        size: width * height + depth,
        dataType: VtkDataTypes.FLOAT, // values encoding
        name: 'scalars'
    });
    scalars.setData(volumeData, 1)
    var renderData = vtkImageData.newInstance();
    renderData.setOrigin(0, 0, 0);
    renderData.setSpacing(1, 1, 5 / 0.98);
    renderData.setExtent(0, width - 1, 0, height - 1, 0, depth - 1);
    renderData.getPointData().setScalars(scalars);

    const dataArray = renderData.getPointData().getScalars();
    const dataRange = dataArray.getRange();
    globalDataRange[0] = dataRange[0];
    globalDataRange[1] = dataRange[1];

    // Update Lookup table
    changePreset();
    // Automatic switch to next preset every 5s
    if (!rootContainer) {
        intervalID = setInterval(changePreset, 5000);
    }

    widget.setDataArray(dataArray.getData());
    widget.applyOpacity(piecewiseFunction);

    widget.setColorTransferFunction(lookupTable);
    lookupTable.onModified(() => {
        widget.render();
        renderWindow.render();
    });
    actor.setMapper(mapper);
    mapper.setInputData(renderData);

    actor.getProperty().setRGBTransferFunction(0, lookupTable);
    actor.getProperty().setScalarOpacity(0, piecewiseFunction);
    actor.getProperty().setInterpolationTypeToFastLinear();
    renderer.addVolume(actor);
    renderer.resetCamera();
    renderer.getActiveCamera().elevation(70);
    renderWindow.render();
    // for (let i = 0; i < 3; i++) {
    //     let name = arr[i];
    //     useVolumeThumbnailing(THUMBNAIL_SIZE, name, renderData).then(res => {
    //         let img = document.getElementById(`img${i + 1}`);
    //         img.src = res;
    //         img.alt = name
    //         img.addEventListener('click', (event) => {

    //             changePresetByClick(event.target)
    //         });
    //     });
    // }
}
// dicomParser_loadSingleData(1, 33)




// ----------------------------------------------------------------------------
// Default setting Piecewise function widget
// ----------------------------------------------------------------------------

widget.addGaussian(0.425, 0.5, 0.2, 0.3, 0.2);
widget.addGaussian(0.75, 1, 0.3, 0, 0);

widget.setContainer(widgetContainer);
widget.bindMouseListeners();

widget.onAnimation((start) => {
    if (start) {
        renderWindow.getInteractor().requestAnimation(widget);
    } else {
        renderWindow.getInteractor().cancelAnimation(widget);
    }
});

widget.onOpacityChange(() => {
    widget.applyOpacity(piecewiseFunction);
    if (!renderWindow.getInteractor().isAnimating()) {
        renderWindow.render();
    }
});

// ----------------------------------------------------------------------------
// Expose variable to global namespace
// ----------------------------------------------------------------------------

window.widget = widget;

const InitViewIDs = {
    Coronal: 'Coronal',
    Sagittal: 'Sagittal',
    Axial: 'Axial',
    Three: '3D',
}
const InitViewSpecs = {
    [InitViewIDs.Coronal]: {
        viewType: '2D',
        props: {
            viewDirection: 'Right',
            viewUp: 'Superior',
        },
    },
    [InitViewIDs.Sagittal]: {
        viewType: '2D',
        props: {
            viewDirection: 'Posterior',
            viewUp: 'Superior',
        },
    },
    [InitViewIDs.Axial]: {
        viewType: '2D',
        props: {
            viewDirection: 'Superior',
            viewUp: 'Anterior',
        },
    },
    [InitViewIDs.Three]: {
        viewType: '3D',
        props: {
            viewDirection: 'Posterior',
            viewUp: 'Superior',
        },
    },
};
const defaultLPSDirections = () => ({
    Left: glMatrix.vec3.fromValues(1, 0, 0),
    Right: glMatrix.vec3.fromValues(-1, 0, 0),
    Posterior: glMatrix.vec3.fromValues(0, 1, 0),
    Anterior: glMatrix.vec3.fromValues(0, -1, 0),
    Superior: glMatrix.vec3.fromValues(0, 0, 1),
    Inferior: glMatrix.vec3.fromValues(0, 0, -1),

    Coronal: 0,
    Sagittal: 1,
    Axial: 2,
});
const defaultImageMetadata = () => ({
    name: '(none)',
    orientation: glMatrix.mat3.create(),
    lpsOrientation: defaultLPSDirections(),
    spacing: glMatrix.vec3.fromValues(1, 1, 1),
    origin: glMatrix.vec3.create(),
    dimensions: glMatrix.vec3.fromValues(1, 1, 1),
    worldBounds: [0, 1, 0, 1, 0, 1],
    worldToIndex: glMatrix.mat4.create(),
    indexToWorld: glMatrix.mat4.create(),
});
function updateRenderingProperty(prop, mapper, image) {
    const scalars = image.getPointData().getScalars();
    const dataRange = scalars.getRange();

    const sampleDistance =
        0.7 *
        Math.sqrt(
            image
                .getSpacing()
                .map((v) => v * v)
                .reduce((a, b) => a + b, 0)
        );
    mapper.setSampleDistance(sampleDistance * 2 ** (0.4 * 3.0 - 1.5));

    prop.setScalarOpacityUnitDistance(
        0,
        getDiagonalLength(image.getBounds()) / Math.max(...image.getDimensions())
    );
    prop.setGradientOpacityMinimumValue(0, 0);
    prop.setGradientOpacityMaximumValue(0, (dataRange[1] - dataRange[0]) * 0.05);
    // - Use shading based on gradient
    prop.setShade(true);
    prop.setUseGradientOpacity(0, true);
    // - generic good default
    prop.setGradientOpacityMinimumOpacity(0, 0.0);
    prop.setGradientOpacityMaximumOpacity(0, 1.0);
    prop.setAmbient(0.2);
    prop.setDiffuse(0.7);
    prop.setSpecular(0.3);
    prop.setSpecularPower(8.0);
}
function createRenderingPipeline() {
    const actor = vtkVolume.newInstance();
    const mapper = vtkVolumeMapper.newInstance();
    const property = actor.getProperty();
    const cfun = vtkColorTransferFunction.newInstance();
    const ofun = vtkPiecewiseFunction.newInstance();
    property.setRGBTransferFunction(0, cfun);
    property.setScalarOpacity(0, ofun);
    actor.setMapper(mapper);
    return {
        actor,
        mapper,
        property,
        cfun,
        ofun,
    };
}
function createVolumeThumbnailer(size) {
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    const scene = vtkGenericRenderWindow.newInstance({
        listenWindowResize: false,
        background: [0.2, 0.3, 0.4],
    });
    scene.setContainer(container);
    const pipeline = createRenderingPipeline();
    const { actor, mapper } = pipeline;
    const renderer = scene.getRenderer();

    // wrap with proxies for easier usage
    const opacityFuncProxy = vtkPiecewiseFunctionProxy.newInstance({
        piecewiseFunction: pipeline.ofun,
    });
    const colorTransferFuncProxy = vtkLookupTableProxy.newInstance({
        lookupTable: pipeline.cfun,
    });
    return {
        scene,
        pipeline,
        opacityFuncProxy,
        colorTransferFuncProxy,
        setInputImage(image) {
            if (image) {
                mapper.setInputData(image);
                updateRenderingProperty(actor.getProperty(), mapper, image);
                if (!renderer.hasViewProp(actor)) {
                    renderer.addVolume(actor);
                }
            } else {
                renderer.removeVolume(actor);
            }
        },
        resetCameraWithOrientation(direction, up) {
            const image = mapper.getInputData();
            if (image) {
                const camera = renderer.getActiveCamera();
                const bounds = image.getBounds();
                const center = [
                    (bounds[0] + bounds[1]) / 2,
                    (bounds[2] + bounds[3]) / 2,
                    (bounds[4] + bounds[5]) / 2,
                ];

                const position = glMatrix.vec3.clone(center);
                glMatrix.vec3.sub(position, position, direction);
                camera.setFocalPoint(...center);
                camera.setPosition(...position);
                camera.setDirectionOfProjection(...direction);
                camera.setViewUp(...up);
                renderer.resetCamera();
                // ensure correct lighting post camera manip
                renderer.updateLightsGeometryToFollowCamera();
            }
        },
    };
}
function getLPSDirections(direction) {
    // Track the rows and columns that have yet to be assigned.
    const availableCols = [0, 1, 2];
    const availableRows = [0, 1, 2];
    const lpsDirs = defaultLPSDirections();

    for (let i = 0; i < 3; i++) {
        let bestValue = 0;
        let bestValueLoc = [0, 0]; // col, row
        let removeIndices = [0, 0]; // indices into availableCols/Rows for deletion

        availableCols.forEach((col, colIdx) => {
            availableRows.forEach((row, rowIdx) => {
                const value = direction[col * 3 + row];
                if (Math.abs(value) > Math.abs(bestValue)) {
                    bestValue = value;
                    bestValueLoc = [col, row];
                    removeIndices = [colIdx, rowIdx];
                }
            });
        });

        // the row index corresponds to the index of the LPS axis
        const [col, axis] = bestValueLoc;
        const axisVector = direction.slice(col * 3, (col + 1) * 3);
        const vecSign = Math.sign(bestValue);
        const posVector = axisVector.map((c) => c * vecSign);
        const negVector = axisVector.map((c) => c * -vecSign);
        if (axis === 0) {
            // Coronal
            lpsDirs.Left = posVector;
            lpsDirs.Right = negVector;
            lpsDirs.Coronal = col;
        } else if (axis === 1) {
            // Sagittal
            lpsDirs.Posterior = posVector;
            lpsDirs.Anterior = negVector;
            lpsDirs.Sagittal = col;
        } else if (axis === 2) {
            // Axial
            lpsDirs.Superior = posVector;
            lpsDirs.Inferior = negVector;
            lpsDirs.Axial = col;
        }

        availableCols.splice(removeIndices[0], 1);
        availableRows.splice(removeIndices[1], 1);
    }

    return lpsDirs;
}
function useCameraOrientation(viewDirection, viewUp, imageMetadataRef) {
    const orientationMatrix =
        imageMetadataRef.orientation
        ;
    const lpsDirections =
        getLPSDirections(orientationMatrix);
    const cameraDirVec = lpsDirections[viewDirection];
    const cameraUpVec = lpsDirections[viewUp];

    return {
        cameraDirVec,
        cameraUpVec,
    };
}
function useVolumeThumbnailing(thumbnailSize, presetName, currentImageData) {
    return new Promise(res => {
        const thumbnailer = createVolumeThumbnailer(thumbnailSize)
        const { cameraDirVec, cameraUpVec } = useCameraOrientation(
            InitViewSpecs[InitViewIDs.Three].props.viewDirection,
            InitViewSpecs[InitViewIDs.Three].props.viewUp,
            defaultImageMetadata()
        );
        thumbnailer.setInputImage(currentImageData);
        const imageDataRange = currentImageData.getPointData().getScalars().getRange();
        const opRange = getOpacityRangeFromPreset(presetName);
        resetOpacityFunction(
            thumbnailer.opacityFuncProxy,
            opRange || imageDataRange,
            presetName
        );
        thumbnailer.colorTransferFuncProxy.setMode(
            vtkLookupTableProxy.Mode.Preset
        );
        thumbnailer.colorTransferFuncProxy.setPresetName(presetName);
        const ctRange = getColorFunctionRangeFromPreset(presetName);
        thumbnailer.colorTransferFuncProxy.setDataRange(
            ...(ctRange || imageDataRange)
        );
        thumbnailer.resetCameraWithOrientation(
            cameraDirVec,
            cameraUpVec
        );

        const renWin = thumbnailer.scene.getRenderWindow();
        renWin.render();
        renWin.captureImages()[0].then(r => {
            res(r)
        });
    })
}
function getOpacityRangeFromPreset(presetName) {
    const preset = local_getPresetByName(presetName);
    if (preset.EffectiveRange) {
        return [...preset.EffectiveRange];
    }
    return null;
}
function resetOpacityFunction(pwfProxy, dataRange, presetName) {
    // reset pwf proxy range
    pwfProxy.setDataRange(...dataRange);

    const preset = local_getPresetByName(presetName);
    if (preset.OpacityPoints) {
        const OpacityPoints = preset.OpacityPoints;
        const points = [];
        for (let i = 0; i < OpacityPoints.length; i += 2) {
            points.push([OpacityPoints[i], OpacityPoints[i + 1]]);
        }

        const [xmin, xmax] = dataRange;
        const width = xmax - xmin;
        const pointsNormalized = points.map(([x, y]) => [(x - xmin) / width, y]);

        pwfProxy.setMode(vtkPiecewiseFunctionProxy.Mode.Points);
        pwfProxy.setPoints(pointsNormalized);
    } else {
        pwfProxy.setMode(vtkPiecewiseFunctionProxy.Mode.Gaussians);
        pwfProxy.setGaussians(vtkPiecewiseFunctionProxy.Defaults.Gaussians);
    }
}
function getColorFunctionRangeFromPreset(presetName) {
    const preset = local_getPresetByName(presetName);
    if (!preset) return null;

    const { AbsoluteRange, RGBPoints } = preset;
    if (AbsoluteRange && RGBPoints) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < RGBPoints.length; i += 4) {
            min = Math.min(min, RGBPoints[i]);
            max = Math.max(max, RGBPoints[i]);
        }
        return [min, max];
    }
    return null;
}

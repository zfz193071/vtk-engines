/*
 * @Author: 
 * @Date: 2023-09-11 16:22:40
 * @LastEditTime: 2023-09-11 16:29:48
 * @LastEditors: ssy
 * @Description: 
 */
const DATA = {
    ctParaInit :{
        name:'ct',
        dataType:undefined,
        size:[500,500,500 ],
        pixcelSpacing:[2,2,2],
        leftTopOfData:[80,80,80],
        sizeInData:[300,300,300],
        oriInData:[330,330,330],    
        ww: 2000,
        wl:200,
        baseValus: 100,
        maxValus: 1000,    
        BlendMode:1,
        colormapIndex: "B&W",
        opacity:0.9
    },

    ptParaInit : {
        name:'pt',
        dataType:undefined,
        size:[400,400,400],
        pixcelSpacing:[3,3,3],
        sizeInData:[200,200,200],
        leftTopOfData:[10,10,10],
        oriInData:[330,330,330],
        ww: 2000,
        wl:500,
        BlendMode:1,
        baseValus: 100,
        maxValus: 1000,
        colormapIndex: 'PET',
        opacity:0.9
    }
}
export default DATA
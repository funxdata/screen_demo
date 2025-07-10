import { Application, Ticker } from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';

export const init_person = async () => {
  const senkoModel_url =
  "http://192.168.4.111:8864/assets/Senko_Normals/senko.model3.json";
  Live2DModel.registerTicker(Ticker);
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    const app = new Application({
          resizeTo: window,
          view: canvas,
          autoStart: true,
          backgroundColor: 0x1C1C1C,
      });
      (window as any).app = app;
  
      const model = await Live2DModel.from(senkoModel_url);
  
      // 设置锚点为模型中心
      model.anchor.set(0.5, 0.5);
  
      // 设置缩放比例（可选）
      const scale = Math.min(
          app.renderer.width / model.internalModel.width,
          app.renderer.height / model.internalModel.height
      );
      model.scale.set(scale * 0.8); // *0.8 让模型不太紧贴边界
  
      // 设置位置为画布中心
      model.x = app.renderer.width / 2;
      model.y = app.renderer.height / 2;
  
      app.stage.addChild(model as any);
      // app.ticker.add((delta) => {
      //   model.update(delta);
      // });

};




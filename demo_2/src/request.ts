import * as Cfg from "../config/token.ts"

// const apiKey = "<"+Cfg.SECRET_KEY+">"; // 你示例的 sk-xxxx

export const request = async (prompt: string)=>{
    const options = {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${Cfg.SECRET_KEY}`,
            "Content-Type": "application/json",
        },
        body: '{"model":"Qwen/QwQ-32B","messages":[{"role":"user","content":"'+prompt+'"}]}'
    };
      
    const res = await fetch(Cfg.API_URL, options);
    return res;
  }
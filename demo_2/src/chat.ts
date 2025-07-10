import { request as request_chat } from "./request.ts"

const messagesEl = document.getElementById("messages") as HTMLElement;
const promptInput = document.getElementById("prompt") as HTMLInputElement;
export const init_chat = async () => {
    const sendBtn = document.getElementById("send") as HTMLElement;
    sendBtn.onclick = sendPrompt;
    promptInput.onkeydown = (e) => {
        if (e.key === "Enter") sendPrompt();
    };
}


const appendMessage = (text: string | null, from: string)=> {
    const p = document.createElement("p");
    p.textContent = text;
    p.className = from;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }


const sendPrompt= async ()=> {
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    appendMessage("你: " + prompt, "user");
    promptInput.value = "";
    const response = await request_chat(prompt);
    const data = await response.json(); // 读取响应体的 JSON 数据
    const reply = data.choices[0].message.content;
    appendMessage("AI: " + reply, "bot");
  }

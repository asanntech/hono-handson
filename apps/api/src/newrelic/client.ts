import agent from "newrelic";

// アプリが使う New Relic の API を、ここに集める。アプリはエージェントを直接 import せず、このオブジェクトを通す。
// テストでは vi.spyOn(newrelic, ...) で呼び出しを検証する
export const newrelic = {
  setTransactionName: (name: string) => agent.setTransactionName(name),
  addCustomAttributes: (attributes: Record<string, string>) =>
    agent.addCustomAttributes(attributes),
};

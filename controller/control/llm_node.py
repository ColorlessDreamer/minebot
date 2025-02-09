


class LLMNode:
    def __init__(self, llm_chain):
        self.llm_chain = llm_chain

    def __call__(self, state: dict) -> dict:
        # state["input"] is the new input to process.
        response = self.llm_chain.invoke({"input": state["input"]})
        # Store the response in the state; you could also merge previous state here.
        state["response"] = response
        return state

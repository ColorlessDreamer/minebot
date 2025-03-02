import time
from control.controller import Controller
from control.base_models import SenseData

def main(personality_prompt: str = "dain_personality.txt",
         action_prompt: str = "dain_actions.txt") -> None:
    
    ctrl = Controller(personality_prompt, action_prompt)
    last_message_content = None

    while True:
        time.sleep(5)
        sense_data = ctrl.sense()
        
        if not sense_data:
            continue

        current_message = sense_data.last_message
        if current_message:
            current_content = (current_message.username, current_message.message)
            if current_content != last_message_content:
                action = ctrl.think(sense_data)
                if action:
                    ctrl.act(action)
                    last_message_content = current_content

if __name__ == "__main__":
    main()

Read @plan.md @architecture.md and @notes.md first to get up to speed. Right now I'm able to place houses, but I can't go inside them. I'd like to create a separate scene to represent the inside of a house, and have it associated with the house that I placed. If I delete the house in creative mode, the scene associated should also be deleted. For reference I've included an image of what the house looks like right now - we want to only have the player enter if they collide with the door.  I need a corresponding exit door in the house scene that teleports the player back outside the house in the original scene.

We need some kind of default house scene that comes into existence when a house is placed.

So I think this will be the first time we've had more than one scene to save, so think about how this will work. Seems like we need generated IDs or something.

This is a complicated change, so we should do it carefully in steps. First step, let's get the house where it detects a user trying to enter the door - just console log something. Then we'll move forward from there.
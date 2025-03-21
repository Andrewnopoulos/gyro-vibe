The physics handling and movement control code is located primarily in the PhysicsManager class:

  1. Physics handling for pickups: Lines 269-389
    - pickupObject() method (line 269)
    - tryPickupById() method (line 302)
    - prepareBodyForHolding() method (line 419)
  2. Movement control: Lines 460-538
    - updateHeldBody() method (line 460)
    - Force calculation in lines 483-530
    - Rotation control in lines 540-562

  The most critical part is the updateHeldBody() method which contains the sophisticated force system that creates smooth movement of
  held objects.

  
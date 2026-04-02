using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(fileName = "New Items", menuName = "Inventory/Item")]
public class Item : ScriptableObject
{
    new public string name = "New Item";
    public Sprite icon = null;
    public bool isDefaultItem = false;

    public virtual void Use()
    {
        // Use
        // something might happen

        // switch-case
    }

    public void RemoveFromInventory()
    {
        Inventory.instance.Remove(this);
    }
}

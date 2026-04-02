using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Inventory : MonoBehaviour
{
    #region SINGLETON
    public static Inventory instance;

    private void Awake()
    {
        if (instance != null)
        {
            Debug.LogWarning("IS FULL");
            return;
        }

        instance = this;
    }

    #endregion

    public delegate void OnItemChanged();
    public OnItemChanged OnItemChangedCallback;

    public int space = 12;

    public List<Item> items = new List<Item>();

    public bool Add (Item item)
    {
        if (!item.isDefaultItem)
        {
            if(items.Count >= space)
            {
                return false;
            }
            items.Add(item);

            if(OnItemChangedCallback != null)
            {
                OnItemChangedCallback.Invoke();
            }
        }

        return true;
    }

    public int FindItem(string itemName)
    {
        return items.FindIndex(find => find.name == itemName);
    }

    public Item GetItem(string itemName)
    {
        return items.Find(find => find.name == itemName);
    }


    public void Remove (Item item)
    {
        items.Remove(item);

        if(OnItemChangedCallback != null)
        {
            OnItemChangedCallback.Invoke();
        }
    }
}

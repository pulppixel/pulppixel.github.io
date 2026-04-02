using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

public class Interactable : MonoBehaviour
{
    [Range(0f, 10f)]
    public float radius = 3f;
    public Transform interactTransform;
    Inventory inventory;
    public UnityEvent eventTrigger;

    bool isTarget = false;
    protected Transform player;

    bool hasInteract = false;

    public virtual void Interact()
    {
        eventTrigger.Invoke();
    }

    private void Start()
    {
        inventory = FindObjectOfType<Inventory>();
    }

    private void Update()
    {
        if (isTarget && !hasInteract)
        {
            float distance = Vector3.Distance(player.position, interactTransform.position);
            // Interact 되는 부분.
            if (distance <= radius)
            {
                // 적
                // 아이템
                // 인터랙트 가능한 물체 (Item Component 필요)
                switch(this.gameObject.tag)
                {
                    case "Enemy":
                        if (Input.GetKeyDown(KeyCode.Mouse1))
                        {
                            player.LookAt(new Vector3(this.transform.position.x, player.transform.position.y, this.transform.position.z));
                            Interact();
                            hasInteract = true;
                        }
                        break;
                    case "Quest":
                    case "Chest":
                    case "Trigger":
                    case "Info":
                        if (Input.GetKeyDown(KeyCode.Mouse1))
                        {
                            player.LookAt(new Vector3(this.transform.position.x, player.transform.position.y, this.transform.position.z));
                            Interact();
                            hasInteract = true;
                        }
                        break;
                    case "Door":
                        // 여기서 "키"가 없다면 인터랙트 안되게..
                        if (inventory.FindItem("Key") == -1)
                        {
                            player.LookAt(new Vector3(this.transform.position.x, player.transform.position.y, this.transform.position.z));
                            break;
                        }
                        else
                        {
                            if (Input.GetKeyDown(KeyCode.Mouse1))
                            {
                                player.LookAt(new Vector3(this.transform.position.x, player.transform.position.y, this.transform.position.z));
                                Interact();
                                hasInteract = true;
                                inventory.Remove(inventory.GetItem("Key"));
                                break;
                            }
                        }
                        break;
                    default:
                        Interact();
                        hasInteract = true;
                        break;
                }
            }            
        }
    }

    public void OnTargeted(Transform playerTransform)
    {
        isTarget = true;
        player = playerTransform;
        hasInteract = false;
    }

    public void DeTargeted()
    {
        isTarget = false;
        player = null;
        hasInteract = false;
    }

    private void OnDrawGizmosSelected()
    {
        if(interactTransform == null)
        {
            interactTransform = transform;
        }

        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(interactTransform.position, radius);
    }
}

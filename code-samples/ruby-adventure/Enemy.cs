using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(CharacterStats))]
public class Enemy : Interactable
{
    PlayerManager playerManager;
    CharacterStats myStats;

    private void Start()
    {
        playerManager = PlayerManager.instance;
        myStats = GetComponent<CharacterStats>();
    }

    public override void Interact()
    {
        base.Interact();

        EnemyAttack();
    }

    public void EnemyAttack()
    {
        CharacterCombat playerCombat = playerManager.ourPlayer.GetComponent<CharacterCombat>();
        if (playerCombat != null)
        {
            playerCombat.Attack(myStats);
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.gameObject.tag == "Player")
        {
            myStats.TakeDamage(6);          
        }
    }
}

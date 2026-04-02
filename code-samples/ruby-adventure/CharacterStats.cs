using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CharacterStats : MonoBehaviour
{
    public int maxHealth = 100;
    
    public int currentHealth { get; private set; }

    public Stat damage;
    public Stat Armor;

    private bool hpResen = false;

    public event System.Action<int, int> OnHealthChanged;

    private void Awake()
    {
        currentHealth = maxHealth;

        // StartCoroutine(HPResen());
    }
    
    public void TakeDamage(int damage)
    {
        if (currentHealth <= 0)
        {
            Die();
        }

        damage -= Armor.GetValue();
        damage = Mathf.Clamp(damage, 0, int.MaxValue);

        currentHealth -= damage;
        Debug.Log(transform.name + " takes " + damage + " damage.");

        if (!hpResen && this.gameObject.tag == "Player")
        {
            StartCoroutine(HPResen());
        }

        if (OnHealthChanged != null)
        {
            OnHealthChanged(maxHealth, currentHealth);
        }
    }

    public void GetPotion()
    {
        if (currentHealth <= maxHealth)
        {
            currentHealth += 20;

            if(currentHealth >= maxHealth)
            {
                currentHealth = maxHealth;
            }
        }
        else
        {
            currentHealth = maxHealth;
        }
    }

    private IEnumerator HPResen()
    {
        hpResen = true;

        while (currentHealth < maxHealth)
        {
            currentHealth += 1;

            yield return new WaitForSeconds(0.9f);
        }

        hpResen = false;
        StopCoroutine(HPResen());
    }

    public virtual void Die()
    {
        // Die in some way
        // This method is meant to be overwritten
        Debug.Log(transform.name + " DIE");
    }
}

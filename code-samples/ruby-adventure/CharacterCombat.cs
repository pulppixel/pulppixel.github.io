using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(CharacterStats))]
public class CharacterCombat : MonoBehaviour
{
    public float attackSpeed = 1f;
    private float attackCooldown = 0f;
    private Animator m_Animator;
    public float attackDelay = .6f;

    public event System.Action OnAttack;

    CharacterStats myStats;

    private void Awake()
    {
        m_Animator = GetComponent<Animator>();
        myStats = GetComponent<CharacterStats>();
    }

    private void Update()
    {
        attackCooldown -= Time.deltaTime;
    }

    public void Attack(CharacterStats targetStats)
    {
        if (attackCooldown <= 0f)
        {
            StartCoroutine(DoDamage(targetStats, attackDelay));

            if (OnAttack != null)
            {
                OnAttack();
            }

            attackCooldown = 1f / attackSpeed;
        }
    }

    IEnumerator DoDamage(CharacterStats stats, float delay)
    {
        if (waitAnimating("Attack") || waitAnimating("Attack 0") || waitAnimating("Attack 1") || waitAnimating("Attack 2") || waitAnimating("Attack 3") || waitAnimating("Attack 4"))
        {
            yield return null;
        }

        else
        {
            m_Animator.SetTrigger("isAttacking");

            stats.TakeDamage(myStats.damage.GetValue());

            yield return new WaitForSeconds(delay);
        }
    }

    private bool waitAnimating(string animationName)
    {
        // 아직 안끝났다면,
        if(m_Animator.GetCurrentAnimatorStateInfo(0).IsName(animationName) && m_Animator.GetCurrentAnimatorStateInfo(0).normalizedTime < 1f)
        {
            // 기다려
            return true;
        }

        // 끝났으면,
        else if(m_Animator.GetCurrentAnimatorStateInfo(0).IsName(animationName) && m_Animator.GetCurrentAnimatorStateInfo(0).normalizedTime >= 1f)
        {
            // 안 기다려도 돼.
            return false;
        }

        // 오류.
        else
        {
            // 다른 스테이트 일 때니까 기다릴 필요 없어..
            return false;
        }
    }
}

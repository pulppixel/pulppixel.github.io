using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

public class EnemyController : MonoBehaviour
{
    [Range(0f, 15f)]
    public float lookRadius = 10f;
    [Range(0f, 15f)]
    public float attackRadius = 3.5f;
    public float speed;

    Transform playerTarget;
    Animator m_Animator;
    NavMeshAgent m_NavMesh;
    CharacterCombat combat;

    private bool isWalking = false;

    private void Start()
    {
        playerTarget = PlayerManager.instance.ourPlayer.transform;
        m_NavMesh = GetComponent<NavMeshAgent>();
        m_Animator = GetComponent<Animator>();
        combat = GetComponent<CharacterCombat>();
    }

    private void Update()
    {
        float distance = Vector3.Distance(playerTarget.position, this.transform.position);

        SetAnimator();

        if(distance <= lookRadius)
        {
            if (distance > attackRadius)
            {
                m_NavMesh.speed = speed;               
                m_NavMesh.SetDestination(playerTarget.position);
                isWalking = true;
            }
            else
            {
                m_NavMesh.ResetPath();
                m_NavMesh.speed = 0.0f;
                // ATTACK THE TARGET
                CharacterStats targetStats = playerTarget.GetComponent<CharacterStats>();
                if (targetStats != null)
                {
                    isWalking = false;
                    combat.Attack(targetStats);
                }
                // FACE TO TARGET
                LookatTarget();
            }
        }

        else
        {
            m_NavMesh.speed = 0.0f;
            isWalking = false;
        }
    }

    private void LookatTarget()
    {
        Vector3 direction = (playerTarget.position - transform.position).normalized;
        Quaternion lookRotation = Quaternion.LookRotation(new Vector3(direction.x, 0.0f, direction.z));
        transform.rotation = Quaternion.Slerp(transform.rotation, lookRotation, Time.deltaTime * 10.0f);
    }

    private void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(transform.position, lookRadius);

        Gizmos.color = Color.blue;
        Gizmos.DrawWireSphere(transform.position, attackRadius);
    }

    private void SetAnimator()
    {
        m_Animator.SetBool("isWalking", isWalking);
    }
}

using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class MageController : MonoBehaviour
{
    public GameObject prefabs;
    public Transform spawnTransform;
    private Transform player;
    private Animator m_Animator;
    private EnemyStats thisStat;
    AudioSource audio;
    public AudioClip effect;

    private void Start()
    {
        audio = GetComponent<AudioSource>();
        audio.clip = effect;
        audio.loop = false;
        player = PlayerManager.instance.ourPlayer.transform;
        m_Animator = GetComponent<Animator>();
        thisStat = GetComponent<EnemyStats>();
    }

    public void StartAttack()
    {
        StartCoroutine(SpawnMagicFire());
    }

    private void Update()
    {
        transform.LookAt(new Vector3(player.transform.position.x, transform.position.y, player.transform.position.z));
    }

    IEnumerator SpawnMagicFire()
    {
        while (thisStat.currentHealth > 0f && Vector3.Distance(player.transform.position, this.transform.position) >= 5.0f)
        {
            Vector3 dir = (this.transform.position - player.transform.position).normalized;
            yield return new WaitForSeconds(1.5f);
            m_Animator.SetTrigger("isAttacking");

            yield return new WaitForSeconds(1.0f);

            audio.Play();
            GameObject bullet = GameObject.Instantiate(prefabs, spawnTransform.position, Quaternion.Euler(dir));
            bullet.transform.SetParent(null);

            yield return new WaitForSeconds(2.0f);
        }

        StopCoroutine(SpawnMagicFire());
    }
}

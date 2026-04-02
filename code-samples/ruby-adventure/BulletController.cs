using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BulletController : MonoBehaviour
{
    public float speed;
    private Transform target;
    private Vector3 Setdir;
    private float i = 0.0f;
    private float defaultY;
    private bool start = false;


    private void Awake()
    {
        target = PlayerManager.instance.ourPlayer.transform;
        Setdir = (target.position - transform.position).normalized;
        defaultY = this.transform.position.y;
        StartCoroutine(MovetoPlayer());
    }

    private void Update()
    {
        if (transform.position.y <= 1.1f)
        {
            this.transform.position = new Vector3(transform.position.x, 1.1f, transform.position.z);
        }

        if (start)
        {
            i += Time.deltaTime;
            transform.Translate(Setdir * speed * Time.deltaTime);
        }
    }

    IEnumerator MovetoPlayer()
    {
        while (i < 8f)
        {
            Setdir = (target.position - transform.position).normalized;
            yield return new WaitForSeconds(1.5f);
            start = true;
        }

        Destroy(this.gameObject);
    }

    // void 
}

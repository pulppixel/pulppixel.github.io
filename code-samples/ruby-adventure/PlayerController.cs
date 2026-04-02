using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.AI;
using UnityEngine.UI;

public class PlayerController : MonoBehaviour
{
    // INTERACT
    private Interactable interactTarget = null;
    private float interactDistance = 2.5f;
    private bool isClose = false;

    // Nav
    public LayerMask movementMask;
    public LayerMask interactableMask;
    private NavMeshAgent m_NavMeshAgent;
    private Animator m_Animator;
    private CapsuleCollider capsuleCollider;
    private BoxCollider boxCollider;

    // ENEMY
    [HideInInspector]
    public GameObject targetedObject = null;
    private Interactable enemy = null;

    // For Skill 1
    public Vector3 jumpHeight;
    public Image skill1_filled;
    public Image Potion_filled;
    private bool isJumpbool = false;
    private float jumpDownPower = 1.5f;
    private IEnumerator jumpCoroutine;

    // For Skill 2
    private bool Skill2_bool = false;
    private IEnumerator skill2_coroutine;
    public Image skill2_filled;

    // For RunSkill
    public GameObject runPaticle;
    public Image skill3_filled;
    private IEnumerator runnuingCoroutine;
    private bool skillRunning = false;
    private float runningTime = 15.0f;

    // mana UI
    public Image playerMP;
    [Range(0f, 1f)]
    public float MP_Range = 1f;
    private int maxMana = 100;
    public int currentMana { get; private set; }
    private bool manaResen = false;


    // Animator parametor
    private bool isRunning;
    private int isJump = -1;
    private float boring;

    // sound
    public AudioClip runSound;
    private AudioSource audioSource;

    public enum STATE
    {
        IDLE = -1,
        MOVE,
        ATTACK,
        SKILL,
        ITEM,
        NUM,
    };

    public STATE state = STATE.IDLE;        // 현재 상태
    public STATE nextState = STATE.IDLE;    // 다음 상태
    private struct Key
    {
        public bool move_attack;
        public bool interact;
        public bool skill1;
        public bool skill2;
        public bool skill3;
        public bool potion;

        public bool Anykey;
    };

    private Key key;

    private void GetInput()
    {
        this.key.move_attack = false;

        this.key.move_attack |= Input.GetKey(KeyCode.Mouse1);
        this.key.interact = Input.GetKeyDown(KeyCode.Mouse0);
        this.key.skill1 = Input.GetKeyDown(KeyCode.Alpha1);
        this.key.skill2 = Input.GetKeyDown(KeyCode.Alpha2);
        this.key.skill3 = Input.GetKeyDown(KeyCode.Alpha3);
        this.key.potion = Input.GetKeyDown(KeyCode.Q);

        this.key.Anykey = Input.anyKeyDown;
    }

    public void SavePlayer()
    {
        SaveSystem.SavePlayer(this);
    }

    public void LoadPlayer()
    {
        PlayerData data = SaveSystem.LoadPlayer();

        Vector3 position;

        position.x = data.position[0];
        position.y = data.position[1];
        position.z = data.position[2];

        transform.position = position;
    }

    private void Start()
    {
        this.state = STATE.IDLE;

        m_Animator = GetComponent<Animator>();
        m_NavMeshAgent = GetComponent<NavMeshAgent>();
        boxCollider = GetComponent<BoxCollider>();
        capsuleCollider = GetComponent<CapsuleCollider>();

        jumpCoroutine = JumpSkill(jumpHeight);
        //skill2_coroutine = Skill2();
        currentMana = maxMana;

        audioSource = GetComponent<AudioSource>();
    }

    private void Update()
    {        
        // 공격에 사용되는 시간, 스킬에 사용되는 시간, 
        skill1_filled.fillAmount -= 0.3f * Time.deltaTime;
        skill2_filled.fillAmount -= 0.25f * Time.deltaTime;
        skill3_filled.fillAmount -= 0.13f * Time.deltaTime;
        Potion_filled.fillAmount -= 0.09f * Time.deltaTime;


        playerMP.GetComponent<Image>().fillAmount = (float)currentMana / (float)maxMana;
        if (!manaResen)
        {
            StartCoroutine(ManaResen());
        }

        // Any State.
        GetInput();
        AnimatorControll();
        Potion();

        if (m_NavMeshAgent.enabled == false) return;
        
        // 1. 상태 변경 조건.
        if (this.nextState == STATE.IDLE)
        {
            switch (this.state)
            {
                case STATE.IDLE: // -> default state
                    if (this.key.move_attack)
                    {
                        if (m_Animator.GetCurrentAnimatorStateInfo(0).IsName("Potion") && m_Animator.GetCurrentAnimatorStateInfo(0).normalizedTime < 1f)
                        {
                            return;
                        }

                        boring = 0.0f;

                        RaycastHit hit;
                        bool isAttackable = false;
                        float distance = 0.0f;
                        hit = GetRayPoint(ref isAttackable, ref distance);
                        // 만약 IDLE상태에서 가까이 있는 적을 클릭했다면, ATTACK 상태로.

                        if (!isAttackable)
                        {
                            this.nextState = STATE.MOVE;
                        }

                        if (isAttackable && hit.collider.tag == "Enemy" && distance <= interactDistance)
                        {
                            // Debug.Log("can Attackable");
                            targetedObject = hit.collider.gameObject;
                            this.nextState = STATE.ATTACK;
                        }
                        // 
                        else
                        {
                            // Debug.Log("dont't Attackable");
                            this.nextState = STATE.MOVE;
                        }
                    }
                    if ((this.key.skill1 && skill1_filled.fillAmount <= 0.0f && currentMana >= 30) || 
                        (this.key.skill2 && skill2_filled.fillAmount <= 0.0f && currentMana >= 45) ||
                        (this.key.skill3 && skill3_filled.fillAmount <= 0.0f && currentMana >= 15))
                    {
                        boring = 0.0f;
                        RemoveInteract();
                        this.nextState = STATE.SKILL;
                    }
                    break;
                case STATE.MOVE:
                    if ((this.key.skill1 && skill1_filled.fillAmount <= 0.0f && currentMana >= 30) ||
                        (this.key.skill2 && skill2_filled.fillAmount <= 0.0f && currentMana >= 45) ||
                        (this.key.skill3 && skill3_filled.fillAmount <= 0.0f && currentMana >= 15))
                    {
                        RemoveInteract();
                        m_NavMeshAgent.isStopped = true;
                        m_NavMeshAgent.ResetPath();
                        this.nextState = STATE.SKILL;
                    }
                    if (targetedObject && m_NavMeshAgent.remainingDistance <= interactDistance)
                    {
                        m_NavMeshAgent.isStopped = true;
                        m_NavMeshAgent.ResetPath();
                        this.nextState = STATE.ATTACK;
                    }
                    // 끝에 도달하면,
                    if (m_NavMeshAgent.remainingDistance <= m_NavMeshAgent.stoppingDistance)
                    {
                        isRunning = false;
                        this.state = STATE.IDLE;
                    }
                    if (m_Animator.GetCurrentAnimatorStateInfo(0).IsName("Potion") && m_Animator.GetCurrentAnimatorStateInfo(0).normalizedTime < 1f)
                    {
                        m_NavMeshAgent.isStopped = true;
                        m_NavMeshAgent.ResetPath();
                        this.state = STATE.IDLE;
                    }
                    break;
                case STATE.ATTACK:
                    if (targetedObject == null)
                    {
                        m_Animator.SetTrigger("isIdleing");
                        this.state = STATE.IDLE;
                    }
                    if ((this.key.skill1 && skill1_filled.fillAmount <= 0.0f && currentMana >= 30) ||
                        (this.key.skill2 && skill2_filled.fillAmount <= 0.0f && currentMana >= 45) ||
                        (this.key.skill3 && skill3_filled.fillAmount <= 0.0f && currentMana >= 15))
                    {
                        RemoveInteract();
                        this.nextState = STATE.SKILL;
                    }
                    if (m_Animator.GetCurrentAnimatorStateInfo(0).IsName("Potion") && m_Animator.GetCurrentAnimatorStateInfo(0).normalizedTime < 1f)
                    {
                        m_NavMeshAgent.isStopped = true;
                        m_NavMeshAgent.ResetPath();
                        this.state = STATE.IDLE;
                    }
                    break;
                case STATE.SKILL:
                    // 이게 루프라 그래.
                    // 만약 스킬 쿨 타임이 끝났다면,
                    if (!isJumpbool || !Skill2_bool)
                    {
                        this.state = STATE.IDLE;
                    }


                    break;
            }
        }

        // 2. 상태가 변할 때
        while (this.nextState != STATE.IDLE)
        {
            this.state = this.nextState;
            this.nextState = STATE.IDLE;    // 다시 위로 ]

            switch (this.state)
            {
                case STATE.ITEM:
                    // 인벤토리에 넣기.
                    break;
                case STATE.MOVE:
                    break;
            }
        }

        // 3. Loop That State
        switch (this.state)
        {
            case STATE.IDLE:
                this.Idle();
                break;
            case STATE.MOVE:
                // this.Avoid();
                this.Move();
                break;
            case STATE.ATTACK:
                this.DefaultAttack();
                break;
            case STATE.SKILL:
                if (!isJumpbool && this.key.skill1 && skill1_filled.fillAmount <= 0.0f && currentMana > 30)
                {
                    // 이거 맞으면 다 넉백.
                    jumpDownPower = 1.5f;
                    jumpCoroutine = JumpSkill(jumpHeight);
                    StartCoroutine(jumpCoroutine);
                }
                if(!Skill2_bool && this.key.skill2 && skill2_filled.fillAmount <= 0.0f && currentMana > 45)
                {
                    skill2_coroutine = Skill2_();
                    StartCoroutine(skill2_coroutine);
                }
                if (!skillRunning && this.key.skill3 && skill3_filled.fillAmount <= 0.0f && currentMana > 15)
                {
                    runnuingCoroutine = RunSkill();
                    StartCoroutine(runnuingCoroutine);
                }
                break;
            case STATE.ITEM:
                break;
        }
    }

    private RaycastHit GetRayPoint(ref bool isInteract, ref float distance)
    {
        Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
        RaycastHit hit;

        // 인터랙트 가능한 물체를 찍었으면 TRUE (코 앞까지 이동)
        if(Physics.Raycast(ray, out hit, 500.0f, interactableMask))
        {
            isInteract = true;
            distance = Vector3.Distance(this.transform.position, hit.transform.position);
            return (hit);
        }
        // 아니라면 FALSE (그냥 이동)
        else if(Physics.Raycast(ray, out hit, 500.0f, movementMask))
        {
            isInteract = false;
            distance = Vector3.Distance(this.transform.position, hit.transform.position);
            return (hit);
        }
        else
        {
            distance = 0.0f;
            return hit;
        }
    }

    private RaycastHit GetRayPoint(ref bool isInteract)
    {
        Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
        RaycastHit hit;

        // 인터랙트 가능한 물체를 찍었으면 TRUE (코 앞까지 이동)
        if (Physics.Raycast(ray, out hit, 500.0f, interactableMask))
        {
            isInteract = true;
            return (hit);
        }
        // 아니라면 FALSE (그냥 이동)
        else if (Physics.Raycast(ray, out hit, 500.0f, movementMask))
        {
            isInteract = false;
            return (hit);
        }
        // 기타 오브젝트를 찍었을 경우,
        else
        {
            isInteract = false;
            return hit;
        }
    }

    private void Idle()
    {
        boring += Time.deltaTime;
        m_Animator.SetFloat("boring", boring);
    }

    private void Potion()
    {
        if (this.key.potion && GetComponent<CharacterStats>().currentHealth < 100 && Potion_filled.fillAmount <= 0.0f)
        {
            Potion_filled.fillAmount = 1.0f;
            m_Animator.SetTrigger("isPotion");
            GetComponent<CharacterStats>().GetPotion();
        }
    }

    private void MoveToPoint(Vector3 point)
    {
        if (!this.key.move_attack) return;

        m_NavMeshAgent.ResetPath();
        bool isStop = false;

        // 멈춤 애니메이션이 진행되는 동안에는
        if (m_Animator.GetCurrentAnimatorStateInfo(0).IsName("RunToStand") && m_Animator.GetCurrentAnimatorStateInfo(0).normalizedTime < 1f)
        {
            isStop = true;
            // 애니메이션이 끝날 때까지 기다려.
        }

        if (!isStop)
        {
            isRunning = true;
            Vector3 direction = (point - transform.position).normalized;
            Quaternion lookRotation = Quaternion.LookRotation(new Vector3(direction.x, transform.position.y, direction.z));
            transform.rotation = Quaternion.Slerp(transform.rotation, lookRotation, Time.deltaTime * 5f);
            m_NavMeshAgent.SetDestination(point);
        }
    }

    // in Update roof.
    private void Move()
    {
        if (!key.move_attack) return;
        if (EventSystem.current.IsPointerOverGameObject()) return;

        // 움직임도 딜레이 넣기 (살짝).

        if (targetedObject != null)
        {
            targetedObject = null;
        }

        if(!skillRunning)
        {
            m_NavMeshAgent.speed = 5.0f;
        }
        
        RaycastHit hit;
        bool isInteractPoint = false;
        float distance = 0.0f;        

        hit = GetRayPoint(ref isInteractPoint, ref distance);
        // 만약에 찍은게 인터랙트 레이어가 적용된 오브젝트다! 그러면 interactDistance보다 작을 때까지만 이동.
        // -> interactPoint 가 True면, remain뭐시기가 interactDistance보다 작을 때까지.
        // Debug.Log("Get Point: " + interactPoint);
        // Debug.Log("Click Interact Object: " + interactPoint + " Distance: " + distance);

        if (hit.point == Vector3.zero) return;

        if (isInteractPoint)
        {
            if (hit.collider.tag == "Wall")
            {
                isRunning = true;
                m_NavMeshAgent.isStopped = false;
                isClose = true;

                m_NavMeshAgent.stoppingDistance = 0.3f;
                MoveToPoint(hit.point);
            }

            else if (hit.collider.tag == "Enemy")
            {
                isRunning = true;
                m_NavMeshAgent.isStopped = false;
                isClose = true;

                m_NavMeshAgent.stoppingDistance = interactDistance * 0.7f;
                MoveToPoint(hit.point);
            }

            else
            {
                Interactable interactable = hit.collider.GetComponent<Interactable>();

                if (interactable != null)
                {
                    if (getInteractObj() == null)
                    {
                        transform.LookAt(new Vector3(interactable.transform.position.x, transform.position.y, interactable.transform.position.z));
                    }
                    SetInteract(interactable);
                }

                isRunning = true;
                m_NavMeshAgent.isStopped = false;
                isClose = true;

                m_NavMeshAgent.stoppingDistance = interactable.radius * 0.4f;
                MoveToPoint(interactable.interactTransform.position);
            }
        }

        else
        {
            RemoveInteract();

            isRunning = true;
            isClose = false;
            m_NavMeshAgent.isStopped = false;

            m_NavMeshAgent.stoppingDistance = 0.0f;
            MoveToPoint(hit.point);
        }
    }

    private IEnumerator RunSkill()
    {
        skill3_filled.fillAmount = 1.0f;
        currentMana -= 15;
        skillRunning = true;
        m_NavMeshAgent.speed = 8.0f;
        runPaticle.SetActive(true);
        audioSource.clip = runSound;
        audioSource.loop = false;
        audioSource.Play();
        
        float i = 0;
        
        while(i < runningTime)
        {
            i += 1.4f;

            yield return new WaitForSeconds(0.2f);
        }

        audioSource.Stop();
        runPaticle.SetActive(false);
        skillRunning = false;
    }
    private void DefaultAttack()
    {
        if (!targetedObject && targetedObject.tag != "Enemy")
        {
            RemoveInteract();
            targetedObject = null;
            return;
        }

        if (getInteractObj() == null || m_Animator.GetCurrentAnimatorStateInfo(0).IsName("Idle"))
        {
            enemy = targetedObject.GetComponent<Enemy>();
            SetInteract(enemy);
        }

        transform.LookAt(new Vector3(enemy.transform.position.x, transform.position.y, enemy.transform.position.z));

        // 타겟 변경.
        if (this.key.move_attack && targetedObject != null)
        {
            RaycastHit hit;
            bool canAttack = false;
            hit = GetRayPoint(ref canAttack);

            if (targetedObject.name != hit.collider.gameObject.name || hit.collider.tag != "Enemy")
            {
                targetedObject = null;
                this.nextState = STATE.MOVE;
                return;
            }

            if (!canAttack)
            {
                this.nextState = STATE.MOVE;
                return;
            }
        }
    }

    private IEnumerator JumpSkill(Vector3 h)
    {
        skill1_filled.fillAmount = 1.0f;
        currentMana -= 30;

        RaycastHit hit;
        Vector3 landingPoint = Vector3.zero;
        Transform defaultRotate = this.transform;
        float YAxis = this.transform.position.y;
        float getYAxis = YAxis + h.y;

        bool isWall = true;

        m_NavMeshAgent.ResetPath();
        m_NavMeshAgent.enabled = false; 
        capsuleCollider.isTrigger = true;

        hit = GetRayPoint(ref isWall);

        if (Vector3.Distance(this.transform.position, hit.point) >= 10.0f)
        {
            landingPoint = new Vector3(this.transform.position.x, this.transform.position.y - 2.0f, this.transform.position.z);
        }
        else
        {
            if (hit.point == Vector3.zero)
            {
                Debug.Log("0");
                landingPoint = new Vector3(this.transform.position.x, this.transform.position.y - 2.0f, this.transform.position.z);
            }
            else
            {
                if (isWall && hit.collider.tag == "Wall")
                {
                    Debug.Log("1");
                    transform.LookAt(new Vector3(hit.point.x, transform.position.y, hit.point.z));
                    landingPoint = new Vector3(this.transform.position.x, this.transform.position.y - 2.0f, this.transform.position.z);
                }
                else if (isWall && hit.collider.tag == "Enemy")
                {
                    Debug.Log("2");
                    transform.LookAt(new Vector3(hit.point.x, transform.position.y, hit.point.z));
                    landingPoint = new Vector3(hit.point.x, hit.point.y -3.0f, hit.point.z);
                }
                else if (isWall)
                {
                    Debug.Log("3");
                    transform.LookAt(new Vector3(hit.point.x, transform.position.y, hit.point.z));
                    landingPoint = new Vector3(this.transform.position.x, this.transform.position.y - 2.0f, this.transform.position.z);
                }
                else
                {
                    Debug.Log("4");
                    landingPoint = hit.point;
                    transform.LookAt(new Vector3(hit.point.x, transform.position.y, hit.point.z));
                }
            }
        }
        // Debug.Log(hit.point);

        


        while (this.transform.position.y <= getYAxis)
        {
            isJump = 0;
            this.transform.Translate(h * 3.5f * Time.deltaTime);
            
            yield return new WaitForSeconds(0.0005f);
        }

        while (isJump == 0)
        {
            isJumpbool = true;
            isJump = 1;
            yield return new WaitForSeconds(0.01f);
        }

        while (isJumpbool)
        {
            RemoveInteract();
            boxCollider.enabled = true;
            jumpDownPower += 0.4f;
            isJump = 1;
            this.transform.position = Vector3.MoveTowards(this.transform.position, landingPoint, jumpDownPower * Time.deltaTime);
            this.transform.Translate(Vector3.down * 0.28f * jumpDownPower * Time.deltaTime);

            yield return new WaitForSeconds(0.0005f);
        }
        isJump = 2;
    }

    private IEnumerator Skill2_()
    {
        currentMana -= 45;
        Skill2_bool = true;
        skill2_filled.fillAmount = 1.0f;

        // 끝났는지 확인. 이름하고 그거.
        while (Skill2_bool)
        {
            RemoveInteract();
            m_NavMeshAgent.speed = 1.2f;
            boxCollider.enabled = true;

            if (m_Animator.GetCurrentAnimatorStateInfo(0).IsName("Skill2_4"))
            {
                Skill2_bool = false;
            }

            yield return new WaitForFixedUpdate();
        }

        boxCollider.enabled = false;

        if (skillRunning)
        {
            m_NavMeshAgent.speed = 10;
        }
        else
        {
            m_NavMeshAgent.speed = 5;
        }

        StopCoroutine(skill2_coroutine);
    }

    private void AnimatorControll()
    {
        m_Animator.SetBool("isRunning", isRunning);
        m_Animator.SetInteger("isJump", isJump);
        m_Animator.SetBool("Skill2", Skill2_bool);
        m_Animator.SetFloat("boring", boring);
    }

    void SetInteract(Interactable newInteract)
    {
        if (newInteract != interactTarget)
        {
            if(interactTarget != null)
            {
                interactTarget.DeTargeted();
            }

            interactTarget = newInteract;
        }

        newInteract.OnTargeted(transform);
    }

    void RemoveInteract()
    {
        if (interactTarget != null)
        {
            interactTarget.DeTargeted();
        }

        interactTarget = null;
    }

    public Interactable getInteractObj()
    {
        if (interactTarget != null)
        {
            return interactTarget;
        }

        else
        {
            return null;
        }
    }
    private IEnumerator ManaResen()
    {
        manaResen = true;

        while (currentMana <= maxMana)
        {
            currentMana += 2;

            yield return new WaitForSeconds(0.25f);
        }

        manaResen = false;
        StopCoroutine(ManaResen());
    }


    // 이거 Trigger로 이벤트 만들면 안되고, 마우스로 해야돼. 아래 꺼 다 삭제.
    private void OnTriggerEnter(Collider other)
    {
        if (other.gameObject.layer == LayerMask.NameToLayer("Floor") && isJumpbool)
        {
            StopCoroutine(jumpCoroutine);
            isJump = -1;
            m_NavMeshAgent.enabled = true;
            isJumpbool = false;
            capsuleCollider.isTrigger = false;
            boxCollider.enabled = false;
        }
    }

    // Trigger로 하면 안돼. 
    // Interactable 스크립트 만들어서 그 스크립트에서 작동하도록.
    // Call back.

    //private void OnInteract()
    //{
    //    if (!interactTarget != null) return;

    //    if (other.gameObject.layer == LayerMask.NameToLayer("Interactable"))
    //    {
    //        Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
    //        RaycastHit hit;
    //        bool isInteract = false;
    //        hit = GetRayPoint(ref isInteract);

    //        // 왼쪽 버튼이라서 괜찮아.
    //        if (this.key.interact && isInteract)
    //        {
    //            targetedObject = other.gameObject;
                
    //            transform.LookAt(targetedObject.transform);

    //            switch (other.tag)
    //            {
    //                case "Item":
    //                    Destroy(other.gameObject);
    //                    break;

    //                case "Chest":
    //                    // Play Animation
    //                    other.gameObject.GetComponentInChildren<ChestAnimation>().OpenAnimation();
    //                    break;

    //                case "Quest":
    //                    other.gameObject.GetComponentInChildren<QuestScript>().StartCoroutine("DoQuest");
    //                    break;

    //                case "Door":
    //                    other.gameObject.GetComponentInChildren<Animator>().SetTrigger("Play");
    //                    break;

    //                case "Scene":
    //                    other.gameObject.GetComponent<SceneChange>().CallScene();
    //                    break;
    //            }
    //        }
    //    }

    //}

}

using UnityEngine;
using UnityEngine.EventSystems;
using System.Collections.Generic;
using Windows.Kinect;
using OpenCvSharp;
using UnityEngine.Events;
using Util;
public class KinectTouchManager : Singleton<KinectTouchManager>
{
    public KinectTouchManager() { }

    private KinectSensor _Sensor;
    private DepthFrameReader _Reader;
    public GroundManager groundManager;

    private CoordinateMapper _Mapper; //

    private List<Vector2> HandList = new List<Vector2>();
    private BodyFrameReader _BodyReader;
    private Body[] _BodyData = null;

    public Body[] GetBodyData()
    {
        return _BodyData;
    }

    private ushort[] _Data;

    public bool IsBodyHandMode = false;

    private UnityAction<int, int> callback;
    private ushort[] GetData()
    {
        return _Data;
    }

    List<Vector3> hits;

    public Vector2 lastHit = Vector2.zero;

    void Awake()
    {
        ModelManager.Instance.Init();
        groundManager = new GroundManager();
        hits = new List<Vector3>();

        _Sensor = KinectSensor.GetDefault();

        if (_Sensor != null)
        {
            _Reader = _Sensor.DepthFrameSource.OpenReader();
            _BodyReader = _Sensor.BodyFrameSource.OpenReader();
            _Mapper = _Sensor.CoordinateMapper;

            _Data = new ushort[_Sensor.DepthFrameSource.FrameDescription.LengthInPixels];

            if (!_Sensor.IsOpen)
            {
                _Sensor.Open();
            }
        }
    }

    public void Reset()
    {
        groundManager = new GroundManager();

        hits = new List<Vector3>();
        callback = null;
    }

    //private void OnEnable()
    //{
    //    StartCoroutine(KinectManager()); 
    //}

    //private void OnDisable()
    //{
    //    StopAllCoroutines();
    //}


    // 바디 정보로 손위치 
    void UpdateBody()
    {
        if (_BodyReader != null)
        {
            var frame = _BodyReader.AcquireLatestFrame();
            if (frame != null)
            {
                if (_BodyData == null)
                {
                    _BodyData = new Body[_Sensor.BodyFrameSource.BodyCount];
                }

                frame.GetAndRefreshBodyData(_BodyData);

                frame.Dispose();
                frame = null;
            }

            Windows.Kinect.Body[] data = GetBodyData();
            if (data == null)
            {
                return;
            }

            HandList.Clear();

            for (int i = 0; i < data.Length; i++)
            {
                if (data[i] == null)
                {
                    continue;
                }

                if (data[i].IsTracked)
                {
                    RefreshBodyObject(data[i]);
                }
            }
        }
    }

    private void RefreshBodyObject(Windows.Kinect.Body body)
    {
        Windows.Kinect.Joint handLeft = body.Joints[JointType.HandLeft];
        Windows.Kinect.Joint handRight = body.Joints[JointType.HandRight];

        Windows.Kinect.CameraSpacePoint[] cameraPoints = new Windows.Kinect.CameraSpacePoint[2];
        Windows.Kinect.DepthSpacePoint[] depthPoints = new Windows.Kinect.DepthSpacePoint[2];

        cameraPoints[0] = handLeft.Position;
        cameraPoints[1] = handRight.Position;

        _Mapper.MapCameraPointsToDepthSpace(cameraPoints, depthPoints);

        if (Config.IsMirror.Equals(false))
        {
            if (handLeft.TrackingState.Equals(TrackingState.Tracked))
            {
                Vector2 v = new Vector2(Config.DEPTH_WIDTH - depthPoints[0].X, depthPoints[0].Y);
                HandList.Add(v);
            }

            if (handRight.TrackingState.Equals(TrackingState.Tracked))
            {
                Vector2 v = new Vector2(Config.DEPTH_WIDTH - depthPoints[1].X, depthPoints[1].Y);
                HandList.Add(v);
            }
        }
        else
        {
            if (handLeft.TrackingState != TrackingState.NotTracked)
            {
                Vector2 v = new Vector2(depthPoints[0].X, depthPoints[0].Y);
                HandList.Add(v);
            }

            if (handRight.TrackingState != TrackingState.NotTracked)
            {
                Vector2 v = new Vector2(depthPoints[1].X, depthPoints[1].Y);
                HandList.Add(v);
            }
        }

    }

    void Update()
    {
        if (callback == null)
            return;

        if (Input.GetMouseButtonDown(0))
        {
            SetBallTouchForMouse(Input.mousePosition.x, Input.mousePosition.y);
        }

        //#if UNITY_EDITOR
        //        if (Input.GetMouseButtonDown(0))
        //        {
        //            setBallTouchForMouse(Input.mousePosition.x, Input.mousePosition.y);
        //        }
        //#endif

        if (groundManager == null)
        {
            return;
        }

        // UpdateBody();

        if (_Reader == null)
            return;

        var frame = _Reader.AcquireLatestFrame();
        if (frame == null)
            return;

        frame.CopyFrameDataToArray(_Data);
        frame.Dispose();
        frame = null;

        groundManager.update(_Data);

        List<Vector3> newHits = new List<Vector3>();
        groundManager.getHit(hits, newHits, IsBodyHandMode, HandList);

        for (int i = 0; i < newHits.Count; i++)
        {
            SetBallTouch(newHits[i].x, newHits[i].y);
        }

        for (int i = 0; i < hits.Count; i++)
        {
            Vector3 vect = hits[i];
            if (vect.z > Time.time)
            {
                if (i != 0)
                {
                    hits.RemoveRange(0, i);
                    //Debug.Log("remove:" + i+":"+ hits.Count);
                }

                break;
            }
            else
            {
                if (i.Equals(0))
                {
                    hits.RemoveRange(0, 1);
                    //Debug.Log("remove0:" + i + ":" + hits.Count);
                }
            }
        }
    }

    //private IEnumerator KinectManager()
    //{
    //    while (this.gameObject)
    //    {
    //        if (callback == null)
    //        {
    //            yield return null;
    //            continue;
    //        }
    //        if (Input.GetMouseButtonDown(0))
    //        {
    //            SetBallTouchForMouse(Input.mousePosition.x, Input.mousePosition.y);
    //        }

    //        //#if UNITY_EDITOR
    //        //        if (Input.GetMouseButtonDown(0))
    //        //        {
    //        //            setBallTouchForMouse(Input.mousePosition.x, Input.mousePosition.y);
    //        //        }
    //        //#endif

    //        if (groundManager == null)
    //        {
    //            yield return null;
    //            continue;
    //        }

    //        UpdateBody();

    //        if (_Reader == null)
    //        {
    //            yield return null;
    //            continue;
    //        }

    //        var frame = _Reader.AcquireLatestFrame();
    //        if (frame == null)
    //        {
    //            yield return null;
    //            continue;
    //        }

    //        frame.CopyFrameDataToArray(_Data);
    //        frame.Dispose();
    //        frame = null;

    //        groundManager.update(_Data);

    //        List<Vector3> newHits = new List<Vector3>();
    //        groundManager.getHit(hits, newHits, IsBodyHandMode, HandList);

    //        for (int i = 0; i < newHits.Count; i++)
    //        {
    //            SetBallTouch(newHits[i].x, newHits[i].y);
    //        }

    //        for (int i = 0; i < hits.Count; i++)
    //        {
    //            Vector3 vect = hits[i];
    //            if (vect.z > Time.time)
    //            {
    //                if (i != 0)
    //                {
    //                    hits.RemoveRange(0, i);
    //                    //Debug.Log("remove:" + i+":"+ hits.Count);
    //                }

    //                break;
    //            }
    //            else
    //            {
    //                if (i.Equals(0))
    //                {
    //                    hits.RemoveRange(0, 1);
    //                    //Debug.Log("remove0:" + i + ":" + hits.Count);
    //                }
    //            }
    //        }
    //        yield return null;
    //    }
    //}
    public void Init(bool IsBodyHandMode, UnityAction<int, int> callback)
    {
        this.callback = callback;
        this.IsBodyHandMode = IsBodyHandMode;
        groundManager.init(IsBallPosInScreen);
    }

    // 키넥트의 공의 위치
    private Vector2 BallPosToScreen(float bx, float by)
    {
        // Depth -> color -> color transform -> screen
        // Depth -> color
        float x = bx * Config.COLOR_WIDTH / (Config.DEPTH_WIDTH);
        float y = Config.COLOR_HEIGHT - by * Config.COLOR_HEIGHT / (Config.DEPTH_HEIGHT);

        // color -> color transform
        Point2f[] src1 = new Point2f[1];

        src1[0] = new Point2f(x, y);

        Point2f[] srcPoint = new Point2f[4];
        Point2f[] dstPoint = new Point2f[4];

        srcPoint[0] = new Point2f(ModelManager.Instance.settingModel.TopLeftX, ModelManager.Instance.settingModel.TopLeftY);
        srcPoint[1] = new Point2f(ModelManager.Instance.settingModel.BottomLeftX, ModelManager.Instance.settingModel.BottomLeftY);
        srcPoint[2] = new Point2f(ModelManager.Instance.settingModel.TopRightX, ModelManager.Instance.settingModel.TopRightY);
        srcPoint[3] = new Point2f(ModelManager.Instance.settingModel.BottomRightX, ModelManager.Instance.settingModel.BottomRightY);

        dstPoint[0] = new Point2f(0.0f, Config.COLOR_HEIGHT);
        dstPoint[1] = new Point2f(0.0f, 0.0f);
        dstPoint[2] = new Point2f(Config.COLOR_WIDTH, Config.COLOR_HEIGHT);
        dstPoint[3] = new Point2f(Config.COLOR_WIDTH, 0.0f);

        Mat mapMatrix = Cv2.GetPerspectiveTransform(srcPoint, dstPoint);
        Point2f[] dda = Cv2.PerspectiveTransform(src1, mapMatrix);

        // color transform -> screen
        x = dda[0].X * Config.SCREEN_WIDTH / Config.COLOR_WIDTH;
        y = dda[0].Y * Config.SCREEN_HEIGHT / Config.COLOR_HEIGHT;

        return new Vector2(x, y);
    }

    // 볼위치가 화면 안인지 체크
    public bool IsBallPosInScreen(float bx, float by)
    {
        // 사다리꼴로 가정한다.
        Vector2 vect = BallPosToScreen(bx, by);

        if (vect.x < 0 || vect.x > Config.SCREEN_WIDTH
              || vect.y < 0 || vect.y > Config.SCREEN_HEIGHT
              )
            return false;

        return true;
    }


    // 스크린 좌표를 볼 좌표로
    private void SetBallTouchForMouse(float xx, float yy)
    {
        //Debug.Log("m:" + xx + ":" + yy);


        //float x = xx * Config.DEPTH_WIDTH / Config.SCREEN_WIDTH;
        //float y = yy * Config.DEPTH_HEIGHT / Config.SCREEN_HEIGHT;

        //Debug.Log("m2:" + x + ":" + y);
        //setBallTouch(x, Config.DEPTH_HEIGHT - y);

        //Debug.Log("m:" + xx + ":" + yy);
        //lastEventTime = Time.time + lastGapTime; 

        //PointerEventData pe = new PointerEventData(EventSystem.current);
        //pe.position = new Vector3(xx, yy, 0.0f);

        //GameObject go = Instantiate(hitEffectImage, RootObject.transform);
        //RectTransform rt = go.GetComponent<RectTransform>();

        //rt.anchoredPosition = new Vector2(xx - Config.SCREEN_WIDTH/2,yy - Config.SCREEN_HEIGHT / 2);

        //List<RaycastResult> hits = new List<RaycastResult>();
        //EventSystem.current.RaycastAll(pe, hits);
        //foreach (RaycastResult rr in hits)
        //{
        //    GameObject target = rr.gameObject;
        //    ExecuteEvents.Execute<IKinectTouchClick>(target, null, (x, y) => x.OnBallClick(xx, yy));
        //}


        //Debug.Log("setBallTouch2:" + xx + ":" + yy);

        PointerEventData pe = new PointerEventData(EventSystem.current);
        pe.position = new Vector3(xx, yy, 0.0f);

        callback((int)(xx - Config.COLOR_WIDTH / 2), (int)(yy - Config.COLOR_HEIGHT / 2));

        lastHit.x = (int)(xx - Config.COLOR_WIDTH / 2);
        lastHit.y = (int)(yy - Config.COLOR_HEIGHT / 2);


        List<RaycastResult> hits = new List<RaycastResult>();
        EventSystem.current.RaycastAll(pe, hits);

        for (int i = 0; i < hits.Count; i++)
        {
            GameObject target = hits[i].gameObject;
            ExecuteEvents.Execute<IKinectTouchClick>(target, null, (x, y) => x.OnBallClick(xx, yy));
        }


    }

    // 볼 이벤트 처리 스크린 좌표
    private void SetBallTouch(float xx, float yy)
    {

        Vector2 vect = BallPosToScreen(xx, yy);

        xx = vect.x;
        yy = vect.y;

        //Debug.Log("setBallTouch2:" + xx + ":" + yy);

        PointerEventData pe = new PointerEventData(EventSystem.current);
        pe.position = new Vector3(xx, yy, 0.0f);

        //GameObject go = Instantiate(hitEffectImage, RootObject.transform);
        //RectTransform rt = go.GetComponent<RectTransform>();

        ////rt.anchoredPosition = new Vector2(xx - Config.SCREEN_WIDTH / 2, yy - Config.SCREEN_HEIGHT / 2);
        //rt.anchoredPosition = new Vector2(xx - Config.COLOR_WIDTH / 2, yy - Config.COLOR_HEIGHT / 2);

        callback((int)(xx - Config.COLOR_WIDTH / 2), (int)(yy - Config.COLOR_HEIGHT / 2));

        lastHit.x = (int)(xx - Config.COLOR_WIDTH / 2);
        lastHit.y = (int)(yy - Config.COLOR_HEIGHT / 2);

        //////////

        List<RaycastResult> hits = new List<RaycastResult>();
        EventSystem.current.RaycastAll(pe, hits);

        for (int i = 0; i < hits.Count; i++)
        {
            GameObject target = hits[i].gameObject;
            ExecuteEvents.Execute<IKinectTouchClick>(target, null, (x, y) => x.OnBallClick(xx, yy));
        }
    }

    void OnApplicationQuit()
    {
        if (_Mapper != null)
        {
            _Mapper = null;
        }

        if (_BodyReader != null)
        {
            _BodyReader.Dispose();
            _BodyReader = null;
        }

        if (_Reader != null)
        {
            _Reader.Dispose();
            _Reader = null;
        }

        if (_Sensor != null)
        {
            if (_Sensor.IsOpen)
            {
                _Sensor.Close();
            }

            _Sensor = null;
        }
    }
}
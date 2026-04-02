using OpenCvSharp;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class AutoKinectPanel : MonoBehaviour
{
    public RawImage ColorImage;
    public Transform Group;

    public GameObject CheckImage;

    public Text SuccessFailText;

    public GameObject ColorSourceManager;
    private ColorSourceManager _ColorManager;


    float time = 1.0f;

    bool IsCheck = false;



    public void OnEnable()
    {
        //AstraDepthManager.Instance.IsColorOn = true;
        //AstraDepthManager.Instance.OnNewColorFrame.AddListener(OnColorStreamChanged);

        CheckImage.SetActive(true);
        time = 1.0f;
        IsCheck = false;
        SuccessFailText.text = "";
    }

    public void OnDisable()
    {
        //AstraDepthManager.Instance.OnNewColorFrame.RemoveListener(OnColorStreamChanged);
        CheckImage.SetActive(true);
    }

    //    private void OnColorStreamChanged(ColorFrame frame)
    private void OnColorStreamChanged()
    {
        //ColorImage.texture = AstraDepthManager.Instance.ColorTexture;

        //Mat mat = OpenCvSharp.Unity.TextureToMat(AstraDepthManager.Instance.ColorTexture);
        if (ColorSourceManager == null)
        {
            return;
        }

        _ColorManager = ColorSourceManager.GetComponent<ColorSourceManager>();
        if (_ColorManager == null)
        {
            return;
        }

        ColorImage.texture = _ColorManager.GetColorTexture();

        Mat mat = OpenCvSharp.Unity.TextureToMat(_ColorManager.GetColorTexture());

        // Convert image to grasyscale
        Mat grayMat1 = new Mat();
        Mat grayMat = new Mat();
        //Cv2.CvtColor(mat, grayMat, ColorConversionCodes.BGR2GRAY);
        Cv2.CvtColor(mat, grayMat1, ColorConversionCodes.RGB2GRAY);


        Cv2.Resize(grayMat1, grayMat, new OpenCvSharp.Size(Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT), 0, 0, InterpolationFlags.Linear);

        Cv2.Flip(grayMat, grayMat, FlipMode.Y);

        //Cv2.CvtColor(mat, grayMat, ColorConversionCodes.RGBA2GRAY);

        // 14,7
        //int px = 14-1;
        //int py = 7-1;

        //  16,9
        //int px = 16-1;
        //int py = 9-1;

        // 15,8 
        int px = 15 - 1;
        int py = 8 - 1;

        if (true == Cv2.FindChessboardCorners(grayMat, new Size(px, py), out Point2f[] conners, ChessboardFlags.AdaptiveThresh | ChessboardFlags.NormalizeImage))
        {
            // index 0
            // index 8
            // 16*9-9
            // 16*9-1

            Debug.Log("L:" + conners.Length.ToString());

            if (conners.Length >= (px * py - 1))
            {
                for (int i = 0; i < 98; i++)
                {
                    Group.GetChild(i).gameObject.GetComponent<Image>().rectTransform.localPosition = GetPos(conners[i]);
                }

                List<Point2f> list = new List<Point2f>();

                list.Add(conners[0]);
                list.Add(conners[px - 1]);
                list.Add(conners[px * py - px]);
                list.Add(conners[px * py - 1]);

                list.Sort((Point2f x, Point2f y) => y.Y.CompareTo(x.Y));

                if (list[0].X < list[1].X)
                {


                }
                else
                {
                    Point2f t = list[0];
                    list[0] = list[1];
                    list[1] = t;
                }


                if (list[2].X < list[3].X)
                {


                }
                else
                {
                    Point2f t = list[2];
                    list[2] = list[3];
                    list[3] = t;
                }

                //Debug.Log("LT:" + list[0].X.ToString() + ":" + list[0].Y.ToString());
                //Debug.Log("RT:" + list[1].X.ToString() + ":" + list[1].Y.ToString());
                //Debug.Log("LB:" + list[2].X.ToString() + ":" + list[2].Y.ToString());
                //Debug.Log("RB:" + list[3].X.ToString() + ":" + list[3].Y.ToString());

                Point2f[] src1 = new Point2f[4];

                src1[0] = new Point2f(0.0f, Config.SCREEN_HEIGHT); // 위 
                src1[1] = new Point2f(0.0f, 0.0f);
                src1[2] = new Point2f(Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
                src1[3] = new Point2f(Config.SCREEN_WIDTH, 0.0f);


                Point2f[] srcPoint = new Point2f[4];
                Point2f[] dstPoint = new Point2f[4];

                float gap = 120.0f;

                srcPoint[0] = new Point2f(gap, Config.SCREEN_HEIGHT - gap);
                srcPoint[1] = new Point2f(gap, gap);
                srcPoint[2] = new Point2f(Config.SCREEN_WIDTH - gap, Config.SCREEN_HEIGHT - gap);
                srcPoint[3] = new Point2f(Config.SCREEN_WIDTH - gap, gap);


                dstPoint[0] = list[0];
                dstPoint[1] = list[2];
                dstPoint[2] = list[1];
                dstPoint[3] = list[3];


                Mat mapMatrix = Cv2.GetPerspectiveTransform(srcPoint, dstPoint);
                Point2f[] TargetPos = Cv2.PerspectiveTransform(src1, mapMatrix);

                TopLeftImage.rectTransform.localPosition = GetPos(TargetPos[0]);
                BottomLeftImage.rectTransform.localPosition = GetPos(TargetPos[1]);
                TopRightImage.rectTransform.localPosition = GetPos(TargetPos[2]);
                BottomRightImage.rectTransform.localPosition = GetPos(TargetPos[3]);

                CheckImage.SetActive(false);
                IsCheck = true;
                //AstraDepthManager.Instance.OnNewColorFrame.RemoveListener(OnColorStreamChanged);

                SuccessFailText.text = "Success";
            }
        }
        else
        {
            //   Debug.Log("no");
        }
    }

    Vector2 GetPos(Point2f pos)
    {
        //int w = ColorImage.texture.width;
        //int h = ColorImage.texture.height;
        //float xx = pos.X * 1280.0f / w;
        //float yy = pos.Y * 720.0f / h;
        //1280
        //720
        //


        //return new Vector2(xx, yy);

        return new Vector2(pos.X, pos.Y);
    }



    Vector2 GetPos2D(float x, float y)
    {
        //int w = ColorImage.texture.width;
        //int h = ColorImage.texture.height;
        //float xx = x * 1280.0f / w;
        //float yy = y * 720.0f / h;
        ////1280
        ////720
        ////


        //return new Vector2(xx, yy);
        return new Vector2(x, y);
    }

    private void Update()
    {

        if (IsCheck == true)
            return;

        time -= Time.deltaTime;

        if (time <= 0)
        {
            CheckImage.SetActive(false);
            SuccessFailText.text = "Fail";
            //AstraDepthManager.Instance.OnNewColorFrame.RemoveListener(OnColorStreamChanged);
        }
        else
        {
            OnColorStreamChanged();
        }
    }


    public Image TopLeftImage;
    public Image TopRightImage;
    public Image BottomLeftImage;
    public Image BottomRightImage;

    public void OnSaveButton()
    {
        ModelManager.Instance.settingModel.TopLeftX = (int)TopLeftImage.rectTransform.localPosition.x;
        ModelManager.Instance.settingModel.TopLeftY = (int)TopLeftImage.rectTransform.localPosition.y;
        ModelManager.Instance.settingModel.TopRightX = (int)TopRightImage.rectTransform.localPosition.x;
        ModelManager.Instance.settingModel.TopRightY = (int)TopRightImage.rectTransform.localPosition.y;

        ModelManager.Instance.settingModel.BottomLeftX = (int)BottomLeftImage.rectTransform.localPosition.x;
        ModelManager.Instance.settingModel.BottomLeftY = (int)BottomLeftImage.rectTransform.localPosition.y;
        ModelManager.Instance.settingModel.BottomRightX = (int)BottomRightImage.rectTransform.localPosition.x;
        ModelManager.Instance.settingModel.BottomRightY = (int)BottomRightImage.rectTransform.localPosition.y;

        ModelManager.Instance.SaveSettingModel();
    }

}

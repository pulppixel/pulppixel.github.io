using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class DialogueManager : MonoBehaviour
{
    public GameObject dialogueIndex;
    public Text nameText;
    public Text dialogueText;
    // 큐!
    public Queue<string> sentences;

    private void Start()
    {
        sentences = new Queue<string>();
    }
    public void StartDialogue (Dialogue dialogue)
    {
        dialogueIndex.SetActive(true);
        nameText.text = dialogue.name;

        sentences.Clear();

        foreach(string sentence in dialogue.sentences)
        {
            sentences.Enqueue(sentence);
        }

        DisplayNextSentence();
    }

    public void DisplayNextSentence()
    {
        if (sentences.Count == 0)
        {
            EndDialogue();
            return;
        }

        string sentence = sentences.Dequeue();
        StopAllCoroutines();
        StartCoroutine(TypeSentence(sentence));
    }

    IEnumerator TypeSentence(string sentence)
    {
        dialogueText.text = "";
        foreach(char letter in sentence.ToCharArray())
        {
            dialogueText.text += letter;
            yield return new WaitForSeconds(0.015f);
        }
    }

    void EndDialogue()
    {
        dialogueIndex.SetActive(false);
    }
}

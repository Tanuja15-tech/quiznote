"use client";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import React from "react";
import Wordcloud from "react-wordcloud";

type Props = {
  formattedTopics: { text: string; value: number }[];
};

const WordCloud = ({ formattedTopics }: Props) => {
  const theme = useTheme();
  const router = useRouter();
  if (!formattedTopics || formattedTopics.length === 0) {
    return <p>No topics available</p>;
  }


  const options = {
    rotations: 1,
    fontFamily: "Times",
    fontSizes: [16, 48] as [number, number], 
    padding: 10,
    colors: theme.theme === "dark" ? ["#ffffff"] : ["#000000"],
  };

  const callbacks = {
    onWordClick: (word: { text: string }) => {
      router.push("/quiz?topic=" + word.text);
    },
  };

  return <Wordcloud words={formattedTopics} options={options} callbacks={callbacks} />;
};

export default WordCloud;

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface OutputFormat {
  [key: string]: string | string[] | OutputFormat;
}

type QAOutput = {
  question: string;
  answer: string;
  [key: string]: string | unknown;
};

export async function strict_output(
  system_prompt: string,
  user_prompt: string | string[],
  output_format: OutputFormat,
  default_category: string = "",
  output_value_only: boolean = false,
  model: string = "gpt-3.5-turbo",
  temperature: number = 1,
  num_tries: number = 3,
  verbose: boolean = false
): Promise<QAOutput[]> {
  const list_input: boolean = Array.isArray(user_prompt);
  const dynamic_elements: boolean = /<.*?>/.test(JSON.stringify(output_format));
  const list_output: boolean = /\[.*?\]/.test(JSON.stringify(output_format));

  let error_msg: string = "";

  for (let i = 0; i < num_tries; i++) {
    let output_format_prompt: string = `\nYou are to output the following in json format: ${JSON.stringify(
      output_format
    )}. \nDo not put quotation marks or escape character \\ in the output fields.`;

    if (list_output) {
      output_format_prompt += `\nIf output field is a list, classify output into the best element of the list.`;
    }

    if (dynamic_elements) {
      output_format_prompt += `\nAny text enclosed by < and > indicates you must generate content to replace it. Example input: Go to <location>, Example output: Go to the garden\nAny output key containing < and > indicates you must generate the key name to replace it. Example input: {'<location>': 'description of location'}, Example output: {school: a place for education}`;
    }

    if (list_input) {
      output_format_prompt += `\nGenerate a list of json, one json for each input element.`;
    }

    // ✅ v5 API
    const response = await openai.chat.completions.create({
      model,
      temperature,
      messages: [
        {
          role: "system",
          content: system_prompt + output_format_prompt + error_msg,
        },
        { role: "user", content: user_prompt.toString() },
      ],
    });

    let res: string =
      response.choices[0]?.message?.content?.replace(/'/g, '"') ?? "";

    res = res.replace(/(\w)"(\w)/g, "$1'$2");

    if (verbose) {
      console.log(
        "System prompt:",
        system_prompt + output_format_prompt + error_msg
      );
      console.log("\nUser prompt:", user_prompt);
      console.log("\nGPT response:", res);
    }

    try {
      let parsed: unknown = JSON.parse(res);

      if (list_input) {
        if (!Array.isArray(parsed)) {
          throw new Error("Output format not in a list of json");
        }
      } else {
        parsed = [parsed];
      }

      const outputList = parsed as QAOutput[];

      for (let index = 0; index < outputList.length; index++) {
        for (const key in output_format) {
          if (/<.*?>/.test(key)) {
            continue;
          }

          if (!(key in outputList[index])) {
            throw new Error(`${key} not in json output`);
          }

          if (Array.isArray(output_format[key])) {
            const choices = output_format[key] as string[];

            if (Array.isArray(outputList[index][key])) {
              outputList[index][key] = (outputList[index][key] as string[])[0];
            }

            if (
              !choices.includes(outputList[index][key] as string) &&
              default_category
            ) {
              outputList[index][key] = default_category;
            }

            if (
              typeof outputList[index][key] === "string" &&
              (outputList[index][key] as string).includes(":")
            ) {
              outputList[index][key] = (
                outputList[index][key] as string
              ).split(":")[0];
            }
          }
        }

        if (output_value_only) {
          const values = Object.values(outputList[index]);
          outputList[index] = {
            question: values[0]?.toString() ?? "",
            answer: values[1]?.toString() ?? "",
          };
        }
      }

      return list_input ? outputList : [outputList[0]];
    } catch (e) {
      error_msg = `\n\nResult: ${res}\n\nError message: ${e}`;
      console.log("An exception occurred:", e);
      console.log("Current invalid json format:", res);
    }
  }

  return [];
}

//   {
//     question: string;
//     answer: string;
//   }[]
// > {
//   // if the user input is in a list, we also process the output as a list of json
//   const list_input: boolean = Array.isArray(user_prompt);
//   // if the output format contains dynamic elements of < or >, then add to the prompt to handle dynamic elements
//   const dynamic_elements: boolean = /<.*?>/.test(JSON.stringify(output_format));
//   // if the output format contains list elements of [ or ], then we add to the prompt to handle lists
//   const list_output: boolean = /\[.*?\]/.test(JSON.stringify(output_format));

//   // start off with no error message
//   let error_msg: string = "";

//   for (let i = 0; i < num_tries; i++) {
//     let output_format_prompt: string = `\nYou are to output the following in json format: ${JSON.stringify(
//       output_format
//     )}. \nDo not put quotation marks or escape character \\ in the output fields.`;

//     if (list_output) {
//       output_format_prompt += `\nIf output field is a list, classify output into the best element of the list.`;
//     }

//     // if output_format contains dynamic elements, process it accordingly
//     if (dynamic_elements) {
//       output_format_prompt += `\nAny text enclosed by < and > indicates you must generate content to replace it. Example input: Go to <location>, Example output: Go to the garden\nAny output key containing < and > indicates you must generate the key name to replace it. Example input: {'<location>': 'description of location'}, Example output: {school: a place for education}`;
//     }

//     // if input is in a list format, ask it to generate json in a list
//     if (list_input) {
//       output_format_prompt += `\nGenerate a list of json, one json for each input element.`;
//     }

//     // Use OpenAI to get a response
//         const response = await openai.chat.completions.create({
//       model,
//       temperature,
//       messages: [
//         {
//           role: "system",
//           content: system_prompt + output_format_prompt + error_msg,
//         },
//         { role: "user", content: user_prompt.toString() },
//       ],
//     });


//     let res: string =
//       response.choices[0].message?.content?.replace(/'/g, '"') ?? "";

//     // ensure that we don't replace away apostrophes in text
//     res = res.replace(/(\w)"(\w)/g, "20rs.'20rs.");

//     if (verbose) {
//       console.log(
//         "System prompt:",
//         system_prompt + output_format_prompt + error_msg
//       );
//       console.log("\nUser prompt:", user_prompt);
//       console.log("\nGPT response:", res);
//     }

//     // try-catch block to ensure output format is adhered to
//     try {
//       let output: unknown = JSON.parse(res);

//       if (list_input) {
//         if (!Array.isArray(output)) {
//           throw new Error("Output format not in a list of json");
//         }
//       } else {
//         output = [output];
//       }
//       const outputList = output as Record<string, any>[];


//       // check for each element in the output_list, the format is correctly adhered to
//       for (let index = 0; index < outputList.length; index++) {
//         for (const key in output_format) {
//           // unable to ensure accuracy of dynamic output header, so skip it
//           if (/<.*?>/.test(key)) {
//             continue;
//           }

//           // if output field missing, raise an error
//           if (!(key in outputList[index])) {
//             throw new Error(`${key} not in json output`);
//           }

//           // check that one of the choices given for the list of words is an unknown
//           if (Array.isArray(output_format[key])) {
//             const choices = output_format[key] as string[];
//             // ensure output is not a list
//             if (Array.isArray(outputList[index][key])) {
//               outputList[index][key] = outputList[index][key][0];
//             }
//             // output the default category (if any) if GPT is unable to identify the category
//             if (!choices.includes(outputList[index][key]) && default_category) {
//               outputList[index][key] = default_category;
//             }
//             // if the output is a description format, get only the label
//             if (outputList[index][key].includes(":")) {
//               outputList[index][key] = outputList[index][key].split(":")[0];
//             }
//           }
//         }

//         // if we just want the values for the outputs
//         if (output_value_only) {
//           outputList[index] = Object.values(outputList[index]);
//           // just output without the list if there is only one element
//           if (outputList[index].length === 1) {
//             outputList[index] = outputList[index][0];
//           }
//         }
//       }

//       return list_input ? outputList : outputList[0];
//     } catch (e) {
//       error_msg = `\n\nResult: ${res}\n\nError message: ${e}`;
//       console.log("An exception occurred:", e);
//       console.log("Current invalid json format:", res);
//     }
//   }

//   return [];
// }
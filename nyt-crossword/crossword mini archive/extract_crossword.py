import json
import sys
import os

def extract_crossword_data(json_file):
    """
    Extract structured data from the NYT Mini Crossword JSON file
    """
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    puzzle = data['body'][0]
    cells = puzzle['cells']
    clues = puzzle['clues']
    clue_lists = puzzle['clueLists']
    
    # Create dictionaries for across and down clues
    across_clues = {}
    down_clues = {}
    
    # Find which clue list is Across and which is Down
    across_index = 0 if clue_lists[0]['name'] == 'Across' else 1
    down_index = 1 - across_index
    
    # Process all clues
    for clue in clues:
        direction = clue['direction']
        label = clue['label']
        text = clue['text'][0]['plain']
        
        # Get the answer by following the cells in the clue
        answer = ""
        for cell_index in clue['cells']:
            if cell_index < len(cells) and 'answer' in cells[cell_index]:
                answer += cells[cell_index]['answer']
        
        if direction == 'Across':
            across_clues[label] = {'clue': text, 'answer': answer}
        else:  # Down
            down_clues[label] = {'clue': text, 'answer': answer}
    
    return {
        'across': across_clues,
        'down': down_clues,
        'dimensions': puzzle['dimensions'],
        'constructor': data.get('constructors', ['Unknown'])[0],
        'publication_date': data.get('publicationDate', '')
    }

def format_crossword_text(extracted_data):
    """
    Format crossword data as text (like in crossword_solution.txt)
    """
    formatted_output = "ACROSS:\n"
    
    # Sort across clues by label (numerically)
    across_labels = sorted(extracted_data['across'].keys(), key=int)
    
    for label in across_labels:
        clue_data = extracted_data['across'][label]
        formatted_output += f"{label}) {clue_data['clue']} = {clue_data['answer']}\n"
    
    formatted_output += "\nDOWN:\n"
    
    # Sort down clues by label (numerically)
    down_labels = sorted(extracted_data['down'].keys(), key=int)
    
    for label in down_labels:
        clue_data = extracted_data['down'][label]
        formatted_output += f"{label}) {clue_data['clue']} = {clue_data['answer']}\n"
    
    return formatted_output

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_crossword.py <nytmini.json> [output_file]")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    if not os.path.exists(json_file):
        print(f"Error: File {json_file} not found.")
        sys.exit(1)
    
    # Extract the data
    extracted_data = extract_crossword_data(json_file)
    
    # Format the data as text
    formatted_text = format_crossword_text(extracted_data)
    
    # Output to file or stdout
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
        with open(output_file, 'w') as f:
            f.write(formatted_text)
        print(f"Crossword data written to {output_file}")
    else:
        print(formatted_text)
    
    # Output the JSON structure for use with the API
    print("\nJSON Structure for API:")
    print(json.dumps({
        'extracted_data': extracted_data,
        'formatted_text': formatted_text
    }, indent=2))

if __name__ == "__main__":
    main() 
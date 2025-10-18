from fastapi import FastAPI, HTTPException # we are importing FastAPI for creating api and HTTPException for handling exceptions
from fastapi.middleware.cors import CORSMiddleware # this middleware allows frontend to call backend from different origin
import google.generativeai as genai # we import genai for summarizing the content from the knowledge sources
import requests # requests library helps us to fetch content from github api
import json # json library is used to store and retrieve data from our local database file
import os # os library is used for file operations and environment variables
from datetime import datetime # we import datetime to track when sources are added
from typing import List, Dict, Optional # these are type hints to ensure type safety in our functions
from dotenv import load_dotenv # we import load_dotenv to read the .env file with environment variables

# we load the .env file so that environment variables like GEMINI_API_KEY are available
load_dotenv()

# we configure the genai with our api key so that we can use gemini for summarization
# we first check if the key exists in environment, if not we use placeholder
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key) # we set the api key if it exists
    print(f"we successfully loaded gemini api key from environment") # we log that key was loaded
else:
    print("we could not find GEMINI_API_KEY in environment variables - using placeholder") # we warn if key not found
    genai.configure(api_key="placeholder") # we set placeholder so app doesn't crash

# we create a FastAPI app instance which will handle all our api requests
app = FastAPI(title="ECHO - Collective Memory Backend", version="1.0")

# we add CORS middleware so that our frontend can make requests to this backend without getting blocked
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # we allow all origins for now, in production this should be specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_FILE = "database.json" # this is where we store all our knowledge nodes and their metadata

def load_database():
    # this function loads the database from the json file, if file doesn't exist it returns empty structure
    if os.path.exists(DATABASE_FILE):
        with open(DATABASE_FILE, 'r') as f:
            return json.load(f) # we load the json and return it
    return {"nodes": [], "next_id": 1} # if file doesn't exist we return default empty structure

def save_database(data):
    # this function saves the database to json file so we can persist the data across app restarts
    with open(DATABASE_FILE, 'w') as f:
        json.dump(data, f, indent=2) # we dump the data with indentation for readability

def fetch_github_content(repo_url):
    # this function takes a github repo url and fetches the readme content using github api
    try:
        # we extract the owner and repo name from the url like https://github.com/OpenMined/PySyft becomes OpenMined/PySyft
        parts = repo_url.replace("https://github.com/", "").strip("/").split("/")
        owner, repo = parts[0], parts[1]
        
        # we construct the github api url to fetch the readme file
        api_url = f"https://api.github.com/repos/{owner}/{repo}/readme"
        
        # we make a request to github api and get the readme content
        response = requests.get(api_url, headers={"Accept": "application/vnd.github.v3.raw"})
        
        if response.status_code == 200: # if request is successful
            return response.text # we return the readme content
        else:
            return None # if repo not found or readme doesn't exist we return None
    except Exception as e:
        print(f"Error fetching GitHub content: {e}") # we print error for debugging
        return None # we return None on error

def summarize_with_gemini(text):
    # this function takes a text and uses gemini api to extract key insights and summarize it
    try:
        # we check if text is empty or too short before sending to api
        if not text or len(text.strip()) < 20:
            print("we received text that is too short to summarize")
            return {
                "key_concepts": ["content analysis"],
                "methods_used": ["text processing"],
                "related_topics": ["knowledge extraction"],
                "insights": "Content too short to analyze"
            }
        
        # we create a detailed prompt that asks gemini to extract structured information from the text
        prompt = f"""
        Analyze this text and extract the following information in a structured format.
        Return ONLY valid JSON, no extra text:
        {{
            "key_concepts": ["idea1", "idea2", "idea3"],
            "methods_used": ["method1", "method2"],
            "related_topics": ["topic1", "topic2"],
            "insights": "summary text"
        }}
        
        Text to analyze:
        {text[:2000]}
        """
        
        # we call gemini api to generate the summary from the prompt
        print("we are calling gemini api to summarize content")
        # we use gemini-2.0-flash-exp which is a newer available model, or gemini-1.5-flash as fallback
        try:
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
        except:
            # if 2.0 is not available we fall back to 1.5
            model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        # we extract the text from response and try to parse it as json
        response_text = response.text
        print(f"we received response from gemini: {response_text[:100]}")
        
        # we find the json part of the response (sometimes gemini adds extra text before or after json)
        try:
            # we look for json content within the response by finding first { and last }
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                # we extract the json substring
                json_str = response_text[json_start:json_end]
                # we parse the json string into a python dictionary
                parsed_json = json.loads(json_str)
                print(f"we successfully parsed json response from gemini")
                return parsed_json
        except json.JSONDecodeError as je:
            # if json parsing fails we log the error and continue to fallback
            print(f"we failed to parse json from gemini response: {je}")
        
        # if automatic parsing fails we return a structured default response with the raw text
        return {
            "key_concepts": ["analysis", "summary"],
            "methods_used": ["text processing"],
            "related_topics": ["information extraction"],
            "insights": response_text[:150] if response_text else "Content captured successfully"
        }
    except Exception as e:
        # we catch any unexpected errors and log them for debugging
        print(f"Error summarizing with Gemini: {e}")
        # we return default summary on error so the system doesn't break completely
        return {
            "key_concepts": ["source analysis"],
            "methods_used": ["content extraction"],
            "related_topics": ["knowledge graphs"],
            "insights": "Content captured successfully. AI summarization failed - using placeholder."
        }

@app.post("/add_source")
async def add_source(repo_url: str = None, title: Optional[str] = None, text_snippet: Optional[str] = None):
    # this endpoint takes a github repo url or text snippet and adds it to our knowledge base
    try:
        database = load_database() # we load the current database
        
        # we determine the content source - either from github or from text_snippet
        if repo_url and repo_url.startswith("http"):
            # we fetch from github using the github api endpoint
            content = fetch_github_content(repo_url)
            if content is None:
                # if we couldnt fetch from github we return error so user knows repo not found
                raise HTTPException(status_code=400, detail="Could not fetch GitHub repository. Make sure URL is correct.")
            source_type = "github"
            source_link = repo_url
        elif text_snippet and len(text_snippet.strip()) > 0:
            # we use the provided text snippet directly without needing github
            content = text_snippet
            source_type = "manual"
            source_link = "direct_input"
        else:
            # both repo_url and text_snippet are empty so we raise error
            raise HTTPException(status_code=400, detail="Either repo_url or text_snippet must be provided")
        
        # we summarize the content using gemini to extract insights and concepts
        print(f"we are summarizing content from {source_type} source")
        summary = summarize_with_gemini(content)
        
        # we create a new node with all the metadata including id, title, content, and summary
        new_node = {
            "id": database["next_id"], # we assign the next id from our counter
            "title": title or f"Source #{database['next_id']}", # we use provided title or auto-generate one
            "content": content[:500] if len(content) > 500 else content, # we store first 500 chars to save space
            "full_content": content, # we also store full content for detailed analysis
            "source": source_link, # we store where this came from (github url or direct)
            "source_type": source_type, # we store the type (github or manual)
            "summary": summary, # we store the gemini summary with concepts and insights
            "created_at": datetime.now().isoformat(), # we timestamp when this was added
            "tags": summary.get("key_concepts", []) # we tag the node with key concepts for filtering
        }
        
        # we add the new node to our nodes list so it gets stored
        database["nodes"].append(new_node)
        
        # we increment the id counter for next source we add
        database["next_id"] += 1
        
        # we save the updated database back to file so it persists
        save_database(database)
        
        # we return the newly created node so frontend knows it was added successfully
        print(f"we successfully added node with id {new_node['id']}")
        return new_node
    
    except HTTPException:
        # we re-raise http exceptions as they are already properly formatted
        raise
    except Exception as e:
        # we catch any unexpected errors and print them for debugging
        print(f"Error adding source: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_nodes")
async def get_nodes(limit: int = 50, offset: int = 0):
    # this endpoint returns all stored nodes with their metadata for visualization on frontend
    try:
        database = load_database() # we load the current database
        
        # we get total count of nodes
        total_nodes = len(database["nodes"])
        
        # we apply pagination - offset to skip first n items, limit to return n items
        paginated_nodes = database["nodes"][offset:offset+limit]
        
        # we also generate edges for visualization - we connect related nodes based on concept similarity
        edges = []
        nodes = database["nodes"]
        
        # we create edges between ALL nodes that exist in database (not just paginated ones)
        # this way graph connections are based on all data not just visible nodes
        for i in range(len(nodes)):
            for j in range(i+1, len(nodes)):
                # we get the key concepts from both nodes - these define what each node is about
                node_i_concepts = set(nodes[i].get("summary", {}).get("key_concepts", []))
                node_j_concepts = set(nodes[j].get("summary", {}).get("key_concepts", []))
                
                # we also get methods used from both nodes
                node_i_methods = set(nodes[i].get("summary", {}).get("methods_used", []))
                node_j_methods = set(nodes[j].get("summary", {}).get("methods_used", []))
                
                # we combine both concepts and methods to get total similarity score
                combined_i = node_i_concepts | node_i_methods
                combined_j = node_j_concepts | node_j_methods
                
                # we calculate similarity as intersection divided by union (jaccard similarity)
                if combined_i and combined_j:
                    # we find common elements between both nodes
                    intersection = len(combined_i & combined_j)
                    union = len(combined_i | combined_j)
                    
                    # we calculate jaccard similarity score between 0 and 1
                    similarity = intersection / union if union > 0 else 0
                    
                    # we create edge only if similarity is above threshold (minimum 0.1 to avoid weak connections)
                    if similarity >= 0.1:
                        edges.append({
                            "source": nodes[i]["id"],
                            "target": nodes[j]["id"],
                            "weight": similarity  # weight represents how similar the nodes are
                        })
                        print(f"we created edge between node {nodes[i]['id']} and {nodes[j]['id']} with similarity {similarity:.2f}")
        
        # we return the nodes and edges for visualization
        return {
            "nodes": paginated_nodes,
            "edges": edges,
            "total": total_nodes,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        # we catch any errors and print them for debugging purposes
        print(f"Error getting nodes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_node/{node_id}")
async def get_node_by_id(node_id: int):
    # this endpoint retrieves a specific node by its id with all details
    try:
        database = load_database() # we load the current database
        
        # we search for the node with matching id
        for node in database["nodes"]:
            if node["id"] == node_id: # if we find the matching id
                return node # we return the complete node
        
        # if node not found we raise 404 error
        raise HTTPException(status_code=404, detail="Node not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting node: {e}") # we print error for debugging
        raise HTTPException(status_code=500, detail=str(e)) # we raise error

@app.get("/health")
async def health_check():
    # this is a simple health check endpoint to ensure backend is running
    return {
        "status": "healthy", # we return healthy status
        "service": "ECHO Backend", # we identify the service
        "version": "1.0"
    }

if __name__ == "__main__":
    import uvicorn # we import uvicorn which is the asgi server for fastapi
    
    # we run the fastapi app on localhost:8000 with auto-reload enabled for development
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

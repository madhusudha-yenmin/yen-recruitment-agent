file_path = r'c:\Users\admin\Documents\GitHub\yen-recruitment-agent\web\src\components\dashboard\HRDashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rename the label in sidebarItems
content = content.replace("label: 'Candidates Ranking'", "label: 'Candidates Resume'")

# 2. Extract the ranking tab contents manually
start_ranking = content.find("{/* VIEW 3: CANDIDATES RANKING PAGE */}")
end_ranking = content.find("{/* VIEW 4: INTERVIEW STATUS", start_ranking)

full_ranking_tab = content[start_ranking:end_ranking]

# The leaderboard div starts inside full_ranking_tab
leaderboard_start = full_ranking_tab.find('<div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">')
# To find the end of this div, we can just find the end of the ranking tab and strip the last two </div> and )} 
leaderboard_end = full_ranking_tab.rfind('</div>', 0, full_ranking_tab.rfind('</div>', 0, full_ranking_tab.rfind('</div>'))) + 6

leaderboard_html = full_ranking_tab[leaderboard_start:leaderboard_end]
if not leaderboard_html.startswith('<div') or not leaderboard_html.endswith('</div>'):
    print("Error slicing leaderboard")
    exit(1)

# 3. Create the new empty ranking tab
new_ranking_tab = '''{/* VIEW 3: CANDIDATES RESUME PAGE */}
          {activeTab === 'ranking' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl text-center py-20 flex flex-col items-center justify-center">
                <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-bold text-slate-300">Candidates Resume</h3>
                <p className="text-sm text-slate-500 mt-2">Resume viewer and parsed details will appear here.</p>
              </div>
            </div>
          )}
          
          '''

# 4. Find the upload-jd tab
start_upload = content.find("{/* VIEW 2: UPLOAD JD SECTION & ORCHESTRATOR */}")
end_upload = content.find("{/* VIEW 3: CANDIDATES RANKING PAGE */}", start_upload)

full_upload_tab = content[start_upload:end_upload]

# The upload tab ends with:
#             </div>
#           )}
# So we insert leaderboard_html right before those last two lines
insert_point = full_upload_tab.rfind('</div>\n            </div>\n          )}')
if insert_point == -1:
    print("Could not find insert point in upload tab")
    exit(1)

new_upload_tab = full_upload_tab[:insert_point] + '  ' + leaderboard_html + '\n' + full_upload_tab[insert_point:]

# 5. Combine everything
new_content = content[:start_upload] + new_upload_tab + new_ranking_tab + content[end_ranking:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("HRDashboard.tsx updated successfully!")

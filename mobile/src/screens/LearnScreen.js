<View style={styles.lessonList}>
              {unit.lessons?.map((lesson) => {
                const locked = isLocked;
                return (
                  <Pressable
                    key={lesson.id}
                    disabled={locked}
                    onPress={() =>
                      navigation.navigate('Lesson', { lessonId: lesson.id, title: lesson.title })
                    }
                    style={[styles.lessonNode, locked && styles.lessonNodeLocked]}
                  >
                    <View style={[styles.nodeIcon, lesson.completed ? styles.nodeDone : (locked ? styles.nodeLocked : styles.nodeCurrent)]}>
                      <Text style={styles.nodeEmoji}>
                        {lesson.completed ? '👑' : locked ? '🔒' : '▶'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lessonTitle, locked && { color: colors.locked }]}>
                        {lesson.title}
                      </Text>
                      {lesson.completed && (
                        <Text style={styles.lessonXp}>+{lesson.xp_reward} XP</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>